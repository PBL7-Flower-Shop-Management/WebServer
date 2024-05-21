import { connectToDB } from "@/utils/database";
import HttpStatus from "http-status";
import bcrypt from "bcryptjs";
import AccountModel from "@/models/AccountModel";
import moment from "moment";
import ApiResponse from "@/utils/ApiResponse";
import UserModel from "@/models/UserModel";
import mongoose from "mongoose";
import {
    generateRandomPassword,
    parseSortString,
    unicodeToAscii,
} from "@/utils/helper";
import { sendMail } from "@/utils/sendMail";

class AccountService {
    async GetAllAccount(query: any): Promise<ApiResponse> {
        return new Promise(async (resolve, reject) => {
            try {
                await connectToDB();

                query.keyword = query.keyword ?? "";
                query.pageNumber = query.pageNumber ?? 1;
                query.pageSize = query.pageSize ?? 10;
                query.isExport = query.isExport ?? false;
                query.orderBy = query.orderBy ?? "username:1";

                const orderBy = parseSortString(query.orderBy);
                if (!orderBy)
                    return reject(
                        new ApiResponse({
                            status: HttpStatus.BAD_REQUEST,
                            message:
                                "Order by field don't follow valid format!",
                        })
                    );

                const accounts = await UserModel.aggregate([
                    {
                        $match: {
                            isDeleted: false,
                        },
                    },
                    {
                        $lookup: {
                            from: "accounts",
                            let: { id: "$_id" },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                {
                                                    $eq: ["$userId", "$$id"],
                                                },
                                                { $eq: ["$isDeleted", false] },
                                                // {
                                                //     $or: [
                                                //         {
                                                //             $regexMatch: {
                                                //                 input: "$username",
                                                //                 regex: query.keyword,
                                                //                 options: "i",
                                                //             },
                                                //         },
                                                //     ],
                                                // },
                                            ],
                                        },
                                    },
                                },
                            ],
                            as: "acc",
                        },
                    },
                    {
                        $unwind: "$acc",
                    },
                    {
                        $match: {
                            $or: [
                                {
                                    role: {
                                        $regex: query.keyword,
                                        $options: "i",
                                    },
                                },
                                {
                                    name: {
                                        $regex: query.keyword,
                                        $options: "i",
                                    },
                                },
                                {
                                    email: {
                                        $regex: query.keyword,
                                        $options: "i",
                                    },
                                },
                                {
                                    "acc.username": {
                                        $regex: query.keyword,
                                        $options: "i",
                                    },
                                },
                            ],
                        },
                    },
                    {
                        $project: {
                            _id: 1,
                            username: "$acc.username",
                            avatar: "$avatar",
                            name: "$name",
                            // citizenId: "$citizenId",
                            email: "$email",
                            // phoneNumber: "$phoneNumber",
                            role: "$role",
                            isActived: "$acc.isActived",
                            createdAt: "$createdAt",
                            createdBy: "$createdBy",
                        },
                    },
                ])
                    .skip(
                        query.isExport
                            ? 0
                            : (query.pageNumber - 1) * query.pageSize
                    )
                    .limit(
                        query.isExport
                            ? Number.MAX_SAFE_INTEGER
                            : query.pageSize
                    )
                    .collation({ locale: "en", caseLevel: false, strength: 1 })
                    .sort(orderBy);

                resolve(
                    new ApiResponse({
                        status: HttpStatus.OK,
                        data: accounts,
                    })
                );
            } catch (error: any) {
                return reject(error);
            }
        });
    }

    async CreateAccount(user: any): Promise<ApiResponse> {
        return new Promise(async (resolve, reject) => {
            await connectToDB();
            const session = await mongoose.startSession();
            session.startTransaction();
            try {
                if (
                    await UserModel.findOne({ email: user.email.toLowerCase() })
                ) {
                    return reject(
                        new ApiResponse({
                            status: HttpStatus.BAD_REQUEST,
                            message: "Email already exists!",
                        })
                    );
                }

                const wordsInName = unicodeToAscii(user.name)
                    .split(" ")
                    .filter((c) => c !== "");

                if (wordsInName.length > 0) {
                    const firstName = wordsInName.pop();
                    if (firstName) {
                        const start =
                            firstName[0].toUpperCase() +
                            firstName.slice(1).toLowerCase();

                        const end = wordsInName
                            .map((w: string) => w[0].toUpperCase())
                            .join("");

                        const username = start + end;
                        user.username = username;
                        let count = 2;
                        while (true) {
                            if (
                                await AccountModel.findOne({
                                    username: user.username,
                                    isDeleted: false,
                                })
                            ) {
                                user.username = username + count;
                                count++;
                            } else break;
                        }
                    }
                }

                //upload image cloudinary

                const currentDate = moment();

                const newUser = await UserModel.create(
                    [
                        {
                            ...user,
                            createdAt: currentDate,
                            createdBy: "System",
                            isDeleted: false,
                        },
                    ],
                    { session: session }
                ).then((res) => res[0]);

                const randomPassword = generateRandomPassword();
                const hashedPassword = await bcrypt.hash(
                    randomPassword,
                    parseInt(process.env.BCRYPT_SALT!)
                );

                await AccountModel.create(
                    [
                        {
                            userId: newUser._id,
                            isActived: user.isActived,
                            username: user.username,
                            password: hashedPassword,
                            createdAt: currentDate,
                            createdBy: "System",
                            isDeleted: false,
                        },
                    ],
                    { session: session }
                );

                await sendMail({
                    to: user.email,
                    subject: "New Account",
                    html: `Tài khoản của bạn đã được tạo trên hệ thống:<br>
                        Tên đăng nhập: ${user.username}<br>
                        Mật khẩu: ${randomPassword}<br>
                        Hãy đăng nhập vào hệ thống ${process.env.LOGIN_PAGE_URL} và đổi mật khẩu ngay để tránh bị lộ thông tin cá nhân.<br>
                        Liên hệ với người quản trị nếu bạn gặp bất kì vấn đề gì khi đăng nhập vào hệ thống!<br>`,
                });

                await session.commitTransaction();

                resolve(
                    new ApiResponse({
                        status: HttpStatus.CREATED,
                        data: newUser,
                    })
                );
            } catch (error: any) {
                await session.abortTransaction();
                return reject(error);
            } finally {
                if (session.inTransaction()) {
                    await session.abortTransaction();
                }
                session.endSession();
            }
        });
    }

    async UpdateAccount(user: any): Promise<ApiResponse> {
        return new Promise(async (resolve, reject) => {
            await connectToDB();
            const session = await mongoose.startSession();
            session.startTransaction();
            try {
                if (
                    !(await UserModel.findOne({
                        _id: user._id,
                        isDeleted: false,
                    })) ||
                    !(await AccountModel.findOne({
                        userId: user._id,
                        isDeleted: false,
                    }))
                )
                    return reject(
                        new ApiResponse({
                            status: HttpStatus.NOT_FOUND,
                            message: "Account not found!",
                        })
                    );

                if (
                    await UserModel.findOne({
                        _id: { $ne: user._id },
                        email: user.email.toLowerCase(),
                    })
                ) {
                    return reject(
                        new ApiResponse({
                            status: HttpStatus.BAD_REQUEST,
                            message: "Email already exists!",
                        })
                    );
                }

                //update image cloudinary

                const updatedUser = await UserModel.findOneAndUpdate(
                    { _id: user._id },
                    {
                        $set: {
                            ...user,
                            updatedAt: moment(),
                            updatedBy: "System",
                        },
                    },
                    { session: session, new: true }
                );

                await session.commitTransaction();

                resolve(
                    new ApiResponse({
                        status: HttpStatus.OK,
                        data: updatedUser,
                    })
                );
            } catch (error: any) {
                await session.abortTransaction();
                return reject(error);
            } finally {
                if (session.inTransaction()) {
                    await session.abortTransaction();
                }
                session.endSession();
            }
        });
    }

    async LockUnLockAccount(user: any): Promise<ApiResponse> {
        return new Promise(async (resolve, reject) => {
            await connectToDB();
            const session = await mongoose.startSession();
            session.startTransaction();
            try {
                if (
                    !(await UserModel.findOne({
                        _id: user._id,
                        isDeleted: false,
                    })) ||
                    !(await AccountModel.findOne({
                        userId: user._id,
                        isDeleted: false,
                    }))
                )
                    return reject(
                        new ApiResponse({
                            status: HttpStatus.NOT_FOUND,
                            message: "Account not found!",
                        })
                    );

                const updatedUser = await AccountModel.findOneAndUpdate(
                    { userId: user._id },
                    {
                        $set: {
                            isActived: user.isActived ?? false,
                            updatedAt: moment(),
                            updatedBy: "System",
                        },
                    },
                    { session: session, new: true }
                );

                await session.commitTransaction();

                resolve(
                    new ApiResponse({
                        status: HttpStatus.OK,
                        data: updatedUser,
                    })
                );
            } catch (error: any) {
                await session.abortTransaction();
                return reject(error);
            } finally {
                if (session.inTransaction()) {
                    await session.abortTransaction();
                }
                session.endSession();
            }
        });
    }

    async GetAccountById(id: string): Promise<ApiResponse> {
        return new Promise(async (resolve, reject) => {
            await connectToDB();
            try {
                if (
                    !(await UserModel.findOne({
                        _id: id,
                        isDeleted: false,
                    })) ||
                    !(await AccountModel.findOne({
                        userId: id,
                        isDeleted: false,
                    }))
                )
                    return reject(
                        new ApiResponse({
                            status: HttpStatus.NOT_FOUND,
                            message: "Account not found!",
                        })
                    );

                const account = await UserModel.aggregate([
                    {
                        $match: {
                            _id: new mongoose.Types.ObjectId(id),
                            isDeleted: false,
                        },
                    },
                    {
                        $lookup: {
                            from: "accounts",
                            localField: "_id",
                            foreignField: "userId",
                            as: "acc",
                        },
                    },
                    {
                        $unwind: "$acc",
                    },
                    {
                        $project: {
                            _id: 1,
                            username: "$acc.username",
                            avatar: "$avatar",
                            name: "$name",
                            citizenId: "$citizenId",
                            email: "$email",
                            phoneNumber: "$phoneNumber",
                            role: "$role",
                            isActived: "$acc.isActived",
                        },
                    },
                ]);

                resolve(
                    new ApiResponse({
                        status: HttpStatus.OK,
                        data: account,
                    })
                );
            } catch (error: any) {
                return reject(error);
            }
        });
    }

    async DeleteAccount(id: string): Promise<ApiResponse> {
        return new Promise(async (resolve, reject) => {
            await connectToDB();
            const session = await mongoose.startSession();
            session.startTransaction();
            try {
                if (
                    !(await UserModel.findOne({
                        _id: id,
                        isDeleted: false,
                    })) ||
                    !(await AccountModel.findOne({
                        userId: id,
                        isDeleted: false,
                    }))
                )
                    return reject(
                        new ApiResponse({
                            status: HttpStatus.NOT_FOUND,
                            message: "Account not found!",
                        })
                    );

                //delete avatar dianary

                await UserModel.findOneAndUpdate(
                    { _id: id },
                    {
                        $set: {
                            isDeleted: true,
                            updatedAt: moment(),
                            updatedBy: "System",
                        },
                    },
                    { session: session, new: true }
                );

                await AccountModel.findOneAndUpdate(
                    { userId: id },
                    {
                        $set: {
                            isDeleted: true,
                            updatedAt: moment(),
                            updatedBy: "System",
                        },
                    },
                    { session: session, new: true }
                );

                await session.commitTransaction();

                resolve(
                    new ApiResponse({
                        status: HttpStatus.NO_CONTENT,
                    })
                );
            } catch (error: any) {
                await session.abortTransaction();
                return reject(error);
            } finally {
                if (session.inTransaction()) {
                    await session.abortTransaction();
                }
                session.endSession();
            }
        });
    }

    async AdminResetPassword(id: string): Promise<ApiResponse> {
        return new Promise(async (resolve, reject) => {
            await connectToDB();

            try {
                if (
                    !(await UserModel.findOne({
                        _id: id,
                        isDeleted: false,
                    })) ||
                    !(await AccountModel.findOne({
                        userId: id,
                        isDeleted: false,
                    }))
                )
                    return reject(
                        new ApiResponse({
                            status: HttpStatus.NOT_FOUND,
                            message: "Account not found!",
                        })
                    );

                const randomPassword = generateRandomPassword();
                const hashedPassword = await bcrypt.hash(
                    randomPassword,
                    parseInt(process.env.BCRYPT_SALT!)
                );

                const user = await UserModel.findById(id);

                await AccountModel.updateOne(
                    { userId: id },
                    {
                        $set: {
                            password: hashedPassword,
                            updatedAt: moment(),
                            updatedBy: "System",
                        },
                    }
                );

                await sendMail({
                    to: user.email,
                    subject: "Thiết lập lại mật khẩu",
                    html: `Mật khẩu cho tài khoản của bạn đã được quản trị viên thiết lập lại:<br>
                        Mật khẩu mới: ${randomPassword}<br>
                        Hãy đăng nhập vào hệ thống ${process.env.LOGIN_PAGE_URL} và đổi mật khẩu ngay để tránh bị lộ thông tin cá nhân.<br>
                        Liên hệ với người quản trị nếu bạn gặp bất kì vấn đề gì khi đăng nhập vào hệ thống!<br>`,
                });

                resolve(
                    new ApiResponse({
                        status: HttpStatus.OK,
                    })
                );
            } catch (error: any) {
                return reject(error);
            }
        });
    }
}

export default new AccountService();

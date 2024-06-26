import FlowerModel from "@/models/FlowerModel";
import HttpStatus from "http-status";
import OrderDetailModel from "@/models/OrderDetailModel";
import OrderModel from "@/models/OrderModel";
import CategoryModel from "@/models/CategoryModel";
import FlowerCategoryModel from "@/models/FlowerCategoryModel";
import { connectToDB } from "@/utils/database";
import ApiResponse from "@/utils/ApiResponse";
import mongoose from "mongoose";
import { calculateTotalPrice, parseSortString } from "@/utils/helper";
import moment from "moment";
import CloudinaryService from "./CloudinaryService";
import { orderStatusMap } from "@/utils/constants";

class FlowerService {
    async GetAllFlower(query: any): Promise<ApiResponse> {
        return new Promise(async (resolve, reject) => {
            try {
                await connectToDB();

                query.keyword = query.keyword ?? "";
                query.pageNumber = query.pageNumber ?? 1;
                query.pageSize = query.pageSize ?? 10;
                query.isExport = query.isExport ?? false;
                query.orderBy = query.orderBy ?? "name:1";

                const orderBy = parseSortString(query.orderBy);
                if (!orderBy)
                    return reject(
                        new ApiResponse({
                            status: HttpStatus.BAD_REQUEST,
                            message:
                                "Order by field don't follow valid format!",
                        })
                    );

                const results = await FlowerModel.aggregate([
                    {
                        $lookup: {
                            from: "flowercategories",
                            localField: "_id",
                            foreignField: "flowerId",
                            as: "fc",
                        },
                    },
                    {
                        $unwind: {
                            path: "$fc",
                            preserveNullAndEmptyArrays: true,
                        },
                    },
                    {
                        $lookup: {
                            from: "categories",
                            localField: "fc.categoryId",
                            foreignField: "_id",
                            as: "category",
                        },
                    },
                    {
                        $unwind: {
                            path: "$category",
                            preserveNullAndEmptyArrays: true,
                        },
                    },
                    {
                        $match: {
                            isDeleted: false,
                            $or: [
                                {
                                    name: {
                                        $regex: query.keyword,
                                        $options: "i",
                                    },
                                },
                                {
                                    habitat: {
                                        $regex: query.keyword,
                                        $options: "i",
                                    },
                                },
                                {
                                    description: {
                                        $regex: query.keyword,
                                        $options: "i",
                                    },
                                },
                                {
                                    "category.categoryName": {
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
                            image: {
                                $cond: [
                                    {
                                        $ne: ["$imageVideoFiles", null],
                                    },
                                    {
                                        $arrayElemAt: [
                                            "$imageVideoFiles.url",
                                            0,
                                        ],
                                    },
                                    null,
                                ],
                            },
                            name: 1,
                            // categoryName: "$category.categoryName",
                            habitat: 1,
                            unitPrice: 1,
                            discount: 1,
                            quantity: 1,
                            soldQuantity: 1,
                            status: 1,
                            description: 1,
                            createdAt: 1,
                            createdBy: 1,
                        },
                    },
                    {
                        $group: {
                            _id: "$_id",
                            image: { $first: "$image" },
                            name: { $first: "$name" },
                            habitat: { $first: "$habitat" },
                            unitPrice: { $first: "$unitPrice" },
                            discount: { $first: "$discount" },
                            quantity: { $first: "$quantity" },
                            soldQuantity: { $first: "$soldQuantity" },
                            status: { $first: "$status" },
                            description: { $first: "$description" },
                            createdAt: { $first: "$createdAt" },
                            createdBy: { $first: "$createdBy" },
                        },
                    },
                    {
                        $sort: orderBy,
                    },
                    {
                        $facet: {
                            // Paginated results
                            paginatedResults: [
                                {
                                    $skip: query.isExport
                                        ? 0
                                        : (query.pageNumber - 1) *
                                          query.pageSize,
                                },
                                {
                                    $limit: query.isExport
                                        ? Number.MAX_SAFE_INTEGER
                                        : query.pageSize,
                                },
                            ],
                            // Count of all documents that match the criteria
                            totalCount: [{ $count: "totalCount" }],
                        },
                    },
                ]).collation({ locale: "en", caseLevel: false, strength: 1 });

                const total =
                    results.length > 0
                        ? results[0].totalCount.length > 0
                            ? results[0].totalCount[0].totalCount
                            : 0
                        : 0;
                const paginatedResults =
                    results.length > 0 ? results[0].paginatedResults : [];

                resolve(
                    new ApiResponse({
                        status: HttpStatus.OK,
                        total: total,
                        data: paginatedResults,
                    })
                );
            } catch (error: any) {
                return reject(error);
            }
        });
    }

    async CreateFlower(flower: any): Promise<ApiResponse> {
        return new Promise(async (resolve, reject) => {
            await connectToDB();
            const session = await mongoose.startSession();
            session.startTransaction({
                readConcern: { level: "snapshot" },
                writeConcern: { w: "majority" },
                maxTimeMS: 5000, // Adjust the timeout as needed
            });
            try {
                if (
                    await FlowerModel.findOne({
                        name: flower.name,
                        isDeleted: false,
                    })
                ) {
                    return reject(
                        new ApiResponse({
                            status: HttpStatus.BAD_REQUEST,
                            message: "Flower name already exists!",
                        })
                    );
                }

                //upload image cloudinary
                let listImageVideoFiles = [];
                for (const image of flower.imageVideoFiles) {
                    const response = await CloudinaryService.Upload(image);
                    console.log(response);
                    listImageVideoFiles.push({
                        url: response.url,
                        public_id: response.public_id,
                    });
                }
                flower.imageVideoFiles = listImageVideoFiles;

                //check category id exists
                if (flower.category) {
                    for (const categoryId of flower.category) {
                        if (
                            !(await CategoryModel.exists({
                                _id: categoryId,
                                isDeleted: false,
                            }))
                        )
                            return reject(
                                new ApiResponse({
                                    status: HttpStatus.BAD_REQUEST,
                                    message: `Category id ${categoryId} don't exists!`,
                                })
                            );
                    }
                }

                const currentDate = moment().toDate();

                let newFlower = await FlowerModel.create(
                    [
                        {
                            ...flower,
                            createdAt: currentDate,
                            createdBy: flower.createdBy ?? "System",
                            isDeleted: false,
                        },
                    ],
                    { session: session }
                ).then((res) => res[0]);

                if (flower.category) {
                    const flowerCategories = flower.category.map(
                        (categoryId: string) => ({
                            flowerId: new mongoose.Types.ObjectId(
                                newFlower._id as string
                            ),
                            categoryId: new mongoose.Types.ObjectId(categoryId),
                        })
                    );

                    await FlowerCategoryModel.insertMany(flowerCategories, {
                        session: session,
                    });
                }

                let newObj = newFlower.toObject();
                newObj.category = flower.category;

                await session.commitTransaction();

                resolve(
                    new ApiResponse({
                        status: HttpStatus.CREATED,
                        data: newObj,
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

    async UpdateFlower(flower: any): Promise<ApiResponse> {
        return new Promise(async (resolve, reject) => {
            await connectToDB();
            const session = await mongoose.startSession();
            session.startTransaction({
                readConcern: { level: "snapshot" },
                writeConcern: { w: "majority" },
                maxTimeMS: 5000, // Adjust the timeout as needed
            });
            try {
                const flowerDb = await FlowerModel.findOne({
                    _id: flower._id,
                    isDeleted: false,
                });
                if (!flowerDb)
                    return reject(
                        new ApiResponse({
                            status: HttpStatus.NOT_FOUND,
                            message: "Flower not found!",
                        })
                    );

                if (
                    await FlowerModel.findOne({
                        _id: { $ne: flower._id },
                        name: flower.name,
                        isDeleted: false,
                    })
                ) {
                    return reject(
                        new ApiResponse({
                            status: HttpStatus.BAD_REQUEST,
                            message: "Flower name already exists!",
                        })
                    );
                }

                //update image cloudinary
                let listSaveFiles = [];

                // Find existing image video
                const existingFiles = flowerDb.imageVideoFiles;

                // Create a map of existing image video for easy lookup
                const existingFilesMap = new Map(
                    existingFiles.map((file: any) => [file.public_id, file])
                );

                if (flower.imageVideoFiles) {
                    // Loop through the new order details
                    for (const newFile of flower.imageVideoFiles) {
                        const existingFile = existingFilesMap.get(
                            newFile.public_id
                        );

                        if (existingFile) {
                            // Remove the processed file from the map
                            existingFilesMap.delete(newFile.public_id);
                            listSaveFiles.push(existingFile);
                        } else {
                            //upload
                            const response = await CloudinaryService.Upload(
                                newFile
                            );

                            listSaveFiles.push({
                                url: response.url,
                                public_id: response.public_id,
                            });
                        }
                    }
                }

                // Delete remaining file that were not in request
                const remainingFiles = Array.from(existingFilesMap.keys());

                for (const file of remainingFiles) {
                    if (file) await CloudinaryService.DeleteByPublicId(file);
                }

                flower.imageVideoFiles = listSaveFiles;

                //check category id exists
                if (flower.category) {
                    for (const categoryId of flower.category) {
                        if (
                            !(await CategoryModel.exists({
                                _id: categoryId,
                                isDeleted: false,
                            }))
                        )
                            return reject(
                                new ApiResponse({
                                    status: HttpStatus.BAD_REQUEST,
                                    message: `Category id ${categoryId} don't exists!`,
                                })
                            );
                    }
                }

                //update order cancelled
                if (
                    flowerDb.unitPrice !== flower.unitPrice ||
                    flowerDb.discount !== flower.discount
                ) {
                    // Find all orders with status "cancelled"
                    const cancelledOrders = await OrderModel.find({
                        status: orderStatusMap.Cancelled,
                        isDeleted: false,
                    }).session(session);

                    // Extract the IDs of these orders
                    const cancelledOrderIds = cancelledOrders.map(
                        (order) => order._id
                    );

                    // Update all orderdetails where flowerId matches and orderId is in the list of cancelled order IDs
                    await OrderDetailModel.updateMany(
                        {
                            flowerId: flowerDb._id,
                            orderId: { $in: cancelledOrderIds },
                        },
                        {
                            $set: {
                                unitPrice: flower.unitPrice,
                                discount: flower.discount,
                            },
                        },
                        {
                            session: session,
                        }
                    );

                    // Find distinct orderIds that were updated (contain flowerDb)
                    const updatedOrderDetails = await OrderDetailModel.distinct(
                        "orderId",
                        {
                            flowerId: flowerDb._id,
                            orderId: { $in: cancelledOrderIds },
                        }
                    );

                    // Step 5: Recalculate and update totalPrice for each updated order
                    for (const orderId of updatedOrderDetails) {
                        const orderDetails = await OrderDetailModel.find({
                            orderId,
                        }).session(session);

                        const order = await OrderModel.findOne({
                            _id: orderId,
                        }).session(session);

                        if (order) {
                            order.totalPrice = calculateTotalPrice(
                                order.shipPrice,
                                order.discount,
                                orderDetails
                            );
                            order.save({ session });
                        }
                    }
                }

                const updatedFlower = await FlowerModel.findOneAndUpdate(
                    { _id: flower._id },
                    {
                        $set: {
                            ...flower,
                            updatedAt: moment().toDate(),
                            updatedBy: flower.updatedBy ?? "System",
                        },
                    },
                    {
                        session: session,
                        new: true,
                        fields: {
                            createdAt: 0,
                            createdBy: 0,
                            updatedAt: 0,
                            updatedBy: 0,
                            isDeleted: 0,
                        },
                    }
                );

                //Remove old categories associated with the flower
                await FlowerCategoryModel.deleteMany(
                    {
                        flowerId: updatedFlower._id,
                    },
                    {
                        session: session,
                    }
                );

                if (flower.category) {
                    //Add new categories associated with the flower
                    const flowerCategories = flower.category.map(
                        (categoryId: string) => ({
                            flowerId: new mongoose.Types.ObjectId(
                                updatedFlower._id as string
                            ),
                            categoryId: new mongoose.Types.ObjectId(categoryId),
                        })
                    );

                    await FlowerCategoryModel.insertMany(flowerCategories, {
                        session: session,
                    });
                }

                let updatedObj = updatedFlower.toObject();
                updatedObj.category = flower.category;

                await session.commitTransaction();

                resolve(
                    new ApiResponse({
                        status: HttpStatus.OK,
                        data: updatedObj,
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

    async GetBestSellerFlower(limit?: number): Promise<ApiResponse> {
        return new Promise(async (resolve, reject) => {
            try {
                await connectToDB();

                const validOrderIds = (
                    await OrderModel.find({
                        status: {
                            $in: [
                                "Shipped",
                                "Delivered",
                                "Pending payment processing",
                            ],
                        },
                        isDeleted: false,
                    })
                ).map((o) => o._id);

                const flowerIds = await OrderDetailModel.aggregate([
                    { $match: { orderId: { $in: validOrderIds } } },
                    {
                        $group: {
                            _id: "$flowerId",
                            totalSold: { $sum: "$numberOfFlowers" },
                        },
                    },
                    {
                        $sort: { totalSold: -1 },
                    },
                    ...(limit ? [{ $limit: limit }] : []),
                    {
                        $project: {
                            _id: 1,
                        },
                    },
                ]);

                const flowers = await FlowerModel.find(
                    {
                        _id: { $in: flowerIds },
                        isDeleted: false,
                    },
                    {
                        name: 1,
                        stars: "$starsTotal",
                        unitPrice: 1,
                        status: 1,
                        discount: 1,
                        image: {
                            $cond: [
                                {
                                    $ne: ["$imageVideoFiles", null],
                                },
                                {
                                    $arrayElemAt: ["$imageVideoFiles.url", 0],
                                },
                                null,
                            ],
                        },
                    }
                );
                resolve(
                    new ApiResponse({
                        status: HttpStatus.OK,
                        data: flowers,
                    })
                );
            } catch (error) {
                return reject(error);
            }
        });
    }

    async GetDecorationFlower(limit?: number): Promise<ApiResponse> {
        return new Promise(async (resolve, reject) => {
            try {
                await connectToDB();

                const decorativeCategories = (
                    await CategoryModel.find({
                        categoryName: "Hoa trưng bày",
                        isDeleted: false,
                    })
                ).map((c) => c._id);

                const decorativeFlowerIds = (
                    await FlowerCategoryModel.find({
                        categoryId: { $in: decorativeCategories },
                    })
                ).map((c) => c.flowerId);

                let flowers = await FlowerModel.find(
                    {
                        _id: { $in: decorativeFlowerIds },
                        isDeleted: false,
                    },
                    {
                        name: 1,
                        stars: "$starsTotal",
                        unitPrice: 1,
                        status: 1,
                        discount: 1,
                        image: {
                            $cond: [
                                {
                                    $ne: ["$imageVideoFiles", null],
                                },
                                {
                                    $arrayElemAt: ["$imageVideoFiles.url", 0],
                                },
                                null,
                            ],
                        },
                    }
                );

                if (limit) {
                    flowers = flowers.slice(0, Math.min(limit, flowers.length));
                }

                resolve(
                    new ApiResponse({
                        status: HttpStatus.OK,
                        data: flowers,
                    })
                );
            } catch (error) {
                return reject(error);
            }
        });
    }

    async GetFlowerAsGift(limit?: number): Promise<ApiResponse> {
        return new Promise(async (resolve, reject) => {
            try {
                await connectToDB();

                const asGiftCategories = (
                    await CategoryModel.find({
                        categoryName: {
                            $in: [
                                "Hoa sinh nhật",
                                "Hoa tốt nghiệp",
                                "Hoa chúc mừng",
                            ],
                        },
                        isDeleted: false,
                    })
                ).map((c) => c._id);

                const asGiftFlowerIds = (
                    await FlowerCategoryModel.find({
                        categoryId: { $in: asGiftCategories },
                    })
                ).map((c) => c.flowerId);

                let flowers = await FlowerModel.find(
                    {
                        _id: { $in: asGiftFlowerIds },
                        isDeleted: false,
                    },
                    {
                        name: 1,
                        stars: "$starsTotal",
                        unitPrice: 1,
                        status: 1,
                        discount: 1,
                        image: {
                            $cond: [
                                {
                                    $ne: ["$imageVideoFiles", null],
                                },
                                {
                                    $arrayElemAt: ["$imageVideoFiles.url", 0],
                                },
                                null,
                            ],
                        },
                    }
                );

                if (limit) {
                    flowers = flowers.slice(0, Math.min(limit, flowers.length));
                }

                resolve(
                    new ApiResponse({
                        status: HttpStatus.OK,
                        data: flowers,
                    })
                );
            } catch (error) {
                return reject(error);
            }
        });
    }

    async GetSuggestedFlower(limit?: number): Promise<ApiResponse> {
        return new Promise(async (resolve, reject) => {
            try {
                await connectToDB();
                const flowers = await FlowerModel.aggregate([
                    { $match: { isDeleted: false } },
                    {
                        $sample: {
                            size:
                                limit ??
                                (await FlowerModel.countDocuments({
                                    isDeleted: false,
                                })),
                        },
                    },
                    {
                        $project: {
                            name: 1,
                            stars: "$starsTotal",
                            unitPrice: 1,
                            status: 1,
                            discount: 1,
                            soldQuantity: 1,
                            image: {
                                $cond: [
                                    {
                                        $ne: ["$imageVideoFiles", null],
                                    },
                                    {
                                        $arrayElemAt: [
                                            "$imageVideoFiles.url",
                                            0,
                                        ],
                                    },
                                    null,
                                ],
                            },
                        },
                    },
                ]);

                resolve(
                    new ApiResponse({
                        status: HttpStatus.OK,
                        data: flowers,
                    })
                );
            } catch (error) {
                return reject(error);
            }
        });
    }

    async GetFlowerDetail(id: string): Promise<ApiResponse> {
        return new Promise(async (resolve, reject) => {
            try {
                await connectToDB();

                const flower = await FlowerModel.findOne(
                    {
                        _id: new mongoose.Types.ObjectId(id),
                        isDeleted: false,
                    },
                    // {
                    //     $lookup: {
                    //         from: "flowercategories",
                    //         localField: "_id",
                    //         foreignField: "flowerId",
                    //         as: "fc",
                    //     },
                    // },
                    // {
                    //     $lookup: {
                    //         from: "categories",
                    //         let: { categoryId: "$fc.categoryId" },
                    //         pipeline: [
                    //             {
                    //                 $match: {
                    //                     $expr: {
                    //                         $and: [
                    //                             {
                    //                                 $eq: ["$flowerId", "$$id"],
                    //                             },
                    //                             { $eq: ["$isDeleted", false] },
                    //                         ],
                    //                     },
                    //                 },
                    //             },
                    //         ],
                    //         as: "acc",
                    //     },
                    // },
                    // {
                    //     $unwind: "$acc",
                    // },
                    {
                        _id: 1,
                        name: 1,
                        habitat: 1,
                        growthTime: 1,
                        care: 1,
                        unitPrice: 1,
                        discount: 1,
                        quantity: 1,
                        soldQuantity: 1,
                        status: 1,
                        description: 1,
                        imageVideoFiles: 1,
                        starsTotal: 1,
                        feedbacksTotal: 1,
                        // category: 1,
                    }
                );

                if (!flower)
                    return reject(
                        new ApiResponse({
                            status: HttpStatus.NOT_FOUND,
                            message: "Not found flower",
                        })
                    );

                const flowerCategories = await FlowerCategoryModel.aggregate([
                    { $match: { flowerId: flower._id } },
                    {
                        $lookup: {
                            from: "categories",
                            localField: "categoryId",
                            foreignField: "_id",
                            as: "category",
                        },
                    },
                    {
                        $unwind: "$category",
                    },
                    {
                        $project: {
                            _id: "$category._id",
                            categoryName: "$category.categoryName",
                        },
                    },
                ]);

                const obj = flower.toObject();
                obj.category = flowerCategories;

                resolve(
                    new ApiResponse({
                        status: HttpStatus.OK,
                        data: obj,
                    })
                );
            } catch (error) {
                return reject(error);
            }
        });
    }

    async GetFeedbackOfFlower(id: string): Promise<ApiResponse> {
        return new Promise(async (resolve, reject) => {
            try {
                await connectToDB();
                const flower = await FlowerModel.findOne({
                    _id: id,
                    isDeleted: false,
                });
                if (!flower)
                    return reject(
                        new ApiResponse({
                            status: HttpStatus.NOT_FOUND,
                            message: "Not found flower",
                        })
                    );

                const feedbacks = await OrderDetailModel.aggregate([
                    {
                        $match: {
                            flowerId: new mongoose.Types.ObjectId(id),
                        },
                    },
                    {
                        $lookup: {
                            from: "comments",
                            localField: "_id",
                            foreignField: "orderDetailId",
                            as: "comments",
                        },
                    },
                    {
                        $unwind: "$comments",
                    },
                    {
                        $lookup: {
                            from: "users",
                            let: { userId: "$comments.userId" },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                {
                                                    $eq: ["$_id", "$$userId"],
                                                },
                                                { $eq: ["$isDeleted", false] },
                                            ],
                                        },
                                    },
                                },
                            ],
                            as: "user",
                        },
                    },
                    {
                        $project: {
                            _id: 0,
                            content: "$comments.content",
                            numberOfStars: "$comments.numberOfStars",
                            numberOfLikes: "$comments.numberOfLikes",
                            feedbackBy: {
                                $cond: {
                                    if: { $eq: [{ $size: "$user" }, 0] },
                                    then: "$comments.userId",
                                    else: { $arrayElemAt: ["$user.name", 0] },
                                },
                            },
                            commentDate: "$comments.commentDate",
                            imageVideoFiles: "$comments.imageVideoFiles",
                        },
                    },
                ]);
                if (feedbacks.length === 0)
                    return reject(
                        new ApiResponse({
                            status: HttpStatus.NOT_FOUND,
                            message: "Not found feedback of this flower",
                        })
                    );
                else
                    resolve(
                        new ApiResponse({
                            status: HttpStatus.OK,
                            data: feedbacks,
                        })
                    );
            } catch (error) {
                return reject(error);
            }
        });
    }

    async DeleteFlower(id: string, username: string): Promise<ApiResponse> {
        return new Promise(async (resolve, reject) => {
            await connectToDB();
            const session = await mongoose.startSession();
            session.startTransaction({
                readConcern: { level: "snapshot" },
                writeConcern: { w: "majority" },
                maxTimeMS: 5000, // Adjust the timeout as needed
            });
            try {
                if (
                    !(await FlowerModel.findOne({
                        _id: id,
                        isDeleted: false,
                    }))
                )
                    return reject(
                        new ApiResponse({
                            status: HttpStatus.NOT_FOUND,
                            message: "Flower not found!",
                        })
                    );

                //delete avatar dianary

                await FlowerModel.findOneAndUpdate(
                    { _id: id },
                    {
                        $set: {
                            isDeleted: true,
                            updatedAt: moment().toDate(),
                            updatedBy: username ?? "system",
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

    async DeleteFlowers(body: any): Promise<ApiResponse> {
        return new Promise(async (resolve, reject) => {
            await connectToDB();
            const session = await mongoose.startSession();
            session.startTransaction({
                readConcern: { level: "snapshot" },
                writeConcern: { w: "majority" },
                maxTimeMS: 5000, // Adjust the timeout as needed
            });
            try {
                //delete avatar dianary
                const objectIds = body.flowerIds.map(
                    (id: string) => new mongoose.Types.ObjectId(id)
                );

                const currentDate = moment().toDate();

                await FlowerModel.updateMany(
                    { _id: { $in: objectIds } },
                    {
                        $set: {
                            isDeleted: true,
                            updatedAt: currentDate,
                            updatedBy: body.updatedBy ?? "System",
                        },
                    },
                    { session: session }
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
}

const flowerService = new FlowerService();
export default flowerService;

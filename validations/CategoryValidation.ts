import mongoose from "mongoose";
import * as yup from "yup";

const schemas = {
    GetAllCategorySchema: yup.object({
        query: yup
            .object({
                keyword: yup
                    .string()
                    .trim()
                    .nullable()
                    .transform((curr, orig) => (orig === "" ? null : curr)),
                pageNumber: yup
                    .number()
                    .integer()
                    .nullable()
                    .transform((curr, orig) => (orig === "" ? null : curr))
                    .min(1)
                    .default(1),
                pageSize: yup
                    .number()
                    .integer()
                    .nullable()
                    .transform((curr, orig) => (orig === "" ? null : curr))
                    .min(1)
                    .default(10),
                isExport: yup.boolean().nullable().default(false),
                orderBy: yup.string().trim().nullable(),
            })
            .noUnknown(true, "Unknown field in request params: ${unknown}")
            .strict(),
    }),

    CreateCategorySchema: yup.object({
        body: yup
            .object({
                categoryName: yup
                    .string()
                    .trim()
                    .required("Category name field is required")
                    .matches(
                        /^[\p{L}\d\s\/\-]+$/u,
                        "Category name only contains characters, number, space, slash and dash!"
                    ),
                description: yup.string().trim().nullable(),
            })
            .noUnknown(true, "Unknown field in request body: ${unknown}")
            .strict(),
    }),

    UpdateCategorySchema: yup.object({
        body: yup
            .object({
                _id: yup
                    .string()
                    .trim()
                    .required()
                    .test(
                        "is-objectid",
                        "Invalid category id format",
                        (value) => mongoose.Types.ObjectId.isValid(value)
                    ),
                categoryName: yup
                    .string()
                    .trim()
                    .required("Category name field is required")
                    .matches(
                        /^[\p{L}\d\s\/\-]+$/u,
                        "Category name only contains characters, number, space, slash and dash!"
                    ),
                avatarUrl: yup.string().nullable(),
                description: yup.string().trim().nullable(),
            })
            .noUnknown(true, "Unknown field in request body: ${unknown}")
            .strict(),
    }),

    GetCategoryWithFlowers: yup.object({
        query: yup.object({
            limit: yup
                .number()
                .integer()
                .nullable()
                .transform((curr, orig) => (orig === "" ? null : curr))
                .min(1),
        }),
    }),
    GetCategoryByIdWithFlowers: yup.object({
        params: yup.object({
            id: yup
                .string()
                .trim()
                .required()
                .test(
                    "is-objectid",
                    "Invalid category id format",
                    (value) =>
                        value === "0" || mongoose.Types.ObjectId.isValid(value)
                ),
        }),
        query: yup.object({
            limit: yup
                .number()
                .integer()
                .nullable()
                .transform((curr, orig) => (orig === "" ? null : curr))
                .min(1),
        }),
    }),

    GetByIdSchema: yup.object({
        params: yup
            .object({
                id: yup
                    .string()
                    .trim()
                    .required()
                    .test(
                        "is-objectid",
                        "Invalid category id format",
                        (value) => mongoose.Types.ObjectId.isValid(value)
                    ),
            })
            .noUnknown(true, "Unknown field in request params: ${unknown}")
            .strict(),
    }),

    DeleteCategorySchema: yup.object({
        params: yup
            .object({
                id: yup
                    .string()
                    .trim()
                    .required()
                    .test(
                        "is-objectid",
                        "Invalid category id format",
                        (value) => mongoose.Types.ObjectId.isValid(value)
                    ),
            })
            .noUnknown(true, "Unknown field in request params: ${unknown}")
            .strict(),
    }),

    DeleteCategoriesSchema: yup.object({
        body: yup
            .object({
                categoryIds: yup
                    .array()
                    .required("CategoryIds are required")
                    .test(
                        "categoryIds-empty",
                        "CategoryIds can't be empty array",
                        function (value) {
                            return value.length !== 0;
                        }
                    )
                    .test(
                        "categoryIds-valid",
                        "Invalid category id format in list of category ids",
                        function (value) {
                            return (
                                value.filter(
                                    (v) =>
                                        typeof v !== "string" ||
                                        v.trim() === "" ||
                                        !mongoose.Types.ObjectId.isValid(v)
                                ).length === 0
                            );
                        }
                    )
                    .test(
                        "categoryIds-distinct",
                        "There can't be two deleted categories that overlap",
                        function (value) {
                            if (value) {
                                return new Set(value).size === value.length;
                            }
                            return true;
                        }
                    ),
            })
            .noUnknown(true, "Unknown field in request body: ${unknown}")
            .strict(),
    }),
};

export default schemas;

import { Schema, model, models } from "mongoose";

const OrderSchema = new Schema(
    {
        orderUserId: {
            type: Schema.Types.ObjectId,
            required: [true, "A order must belong to a user"],
            ref: "User", // Reference to the User model
        },
        orderDate: {
            type: Date,
        },
        shipAddress: {
            type: String,
            maxLength: 200,
            trim: true,
            validate: {
                validator: function (value: any) {
                    return /^[\w\d\s\/\-]+$/u.test(value);
                },
                message:
                    "Ship address only contains characters, number, space, slash and dash!",
            },
        },
        shipPrice: {
            type: Number,
            min: [0, "Ship price can't be negative!"],
            default: 0,
        },
        discount: {
            type: Number,
            min: [0, "Discount cannot be negative!"],
            max: [100, "Discount cannot greater than 100!"],
            default: 0,
        },
        totalPrice: {
            type: Number,
            min: [0, "Total price cannot be negative!"],
            default: 0,
        },
        status: {
            type: String,
            enum: [
                "Processing",
                "Shipped",
                "Delivered",
                "Cancelled",
                "Pending payment processing",
            ],
            default: "Processing",
        },
        paymentMethod: {
            type: String,
        },
        note: {
            type: String,
        },
        createdAt: {
            type: Date,
        },
        createdBy: {
            type: String,
        },
        updatedAt: {
            type: Date,
        },
        updatedBy: {
            type: String,
        },
        isDeleted: {
            type: Boolean,
        },
    },
    {
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
        id: false,
    }
);

const OrderModel = models.Order || model("Order", OrderSchema);

export default OrderModel;

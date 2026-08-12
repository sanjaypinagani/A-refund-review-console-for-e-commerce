const mongoose = require("mongoose");

const decisionSchema = new mongoose.Schema(
    {
        refundId: {
            type: String,
            required: true,
            unique: true
        },

        decision: {
            type: String,
            enum: ["approved", "rejected"],
            required: true
        },

        reason: {
            type: String,
            required: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Decision", decisionSchema);
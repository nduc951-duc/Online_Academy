import express from "express";
import feedbackController from "../controller/feedback.controller.js";
import { requireEnrollment, requireNoFeedback, requireExistingFeedback, requireFeedbackOwnership } from "../middlewares/feedback.mdw.js";
// 1. IMPORT THƯ VIỆN BẢO MẬT
import { body, validationResult } from 'express-validator';
import { rateLimit } from 'express-rate-limit';

const router = express.Router();

// 2. CẤU HÌNH RATE LIMIT (CHỐNG SPAM)
// Chỉ cho phép 1 IP gửi tối đa 2 đánh giá trong vòng 1 phút
const feedbackLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 phút
    max: 2, 
    message: "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Xem danh sách đánh giá của học viên
 * GET /feedback/my-feedbacks
 * Yêu cầu: Đã đăng nhập
 */
router.get("/my-feedbacks", feedbackController.viewMyFeedbacks);

// ==========================
// FEEDBACK ROUTES
// ==========================

/**
 * Hiển thị form đánh giá khóa học
 * GET /feedback/:id
 * Yêu cầu: Đã đăng ký khóa học
 */
router.get("/:id", requireEnrollment, feedbackController.showFeedbackForm);

/**
 * Submit đánh giá mới (ĐÃ ĐƯỢC GIA CỐ BẢO MẬT)
 * Yêu cầu: Đã đăng ký + Chưa đánh giá + Chống spam + Validate input
 */
router.post("/:id", 
    requireEnrollment,    // Logic cũ: Phải là học viên
    requireNoFeedback,    // Logic cũ: Chưa từng đánh giá
    feedbackLimiter,      // <--- MỚI: Chống spam
    [
        // <--- MỚI: Kiểm tra dữ liệu đầu vào
        body('rating').isInt({ min: 1, max: 5 }).withMessage('Điểm đánh giá không hợp lệ'),
        body('feedback').notEmpty().withMessage('Nội dung không được để trống')
                        .trim()
                        .escape() // <--- QUAN TRỌNG: Chống XSS Stored
    ],
    async (req, res, next) => {
        // Kiểm tra lỗi validation
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).send(errors.array()[0].msg);
        }
        // Nếu ổn thì chạy tiếp controller
        feedbackController.submitFeedback(req, res, next);
    }
);

/**
 * Cập nhật đánh giá đã có
 * PUT /feedback/:id/:feedbackId
 * Yêu cầu: Đã đăng ký khóa học + Đã đánh giá + Sở hữu đánh giá
 */
router.put("/:id/:feedbackId", 
    requireEnrollment, 
    requireExistingFeedback, 
    requireFeedbackOwnership,
    [
        // Validate cho chức năng sửa luôn cho chắc
        body('rating').optional().isInt({ min: 1, max: 5 }),
        body('feedback').optional().trim().escape() // <--- Chống XSS khi sửa
    ],
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).send(errors.array()[0].msg);
        feedbackController.updateFeedback(req, res, next);
    }
);

/**
 * Xóa đánh giá
 * DELETE /feedback/:id/:feedbackId
 * Yêu cầu: Đã đăng ký khóa học + Đã đánh giá + Sở hữu đánh giá
 */
router.delete("/:id/:feedbackId", requireEnrollment, requireExistingFeedback, requireFeedbackOwnership, feedbackController.deleteFeedback);

/**
 * Lấy danh sách đánh giá của khóa học (API)
 * GET /feedback/:id/list
 * Không yêu cầu đăng nhập
 */
router.get("/:id/list", feedbackController.getCourseFeedbacks);

/**
 * Lấy đánh giá của học viên cho một khóa học (API)
 * GET /feedback/:id/my
 * Yêu cầu: Đã đăng nhập
 */
router.get("/:id/my", feedbackController.getStudentFeedback);

export default router;
import express from "express";
import accountModel from "../models/accout.model.js";
import bcrypt from "bcrypt";
import mailer from "../utils/mailer.js";
import passport from "../config/passport.js";
import { body, validationResult } from 'express-validator';
import { rateLimit } from 'express-rate-limit';

const router = express.Router();

// --- CẤU HÌNH RATE LIMIT (CHỐNG BRUTE FORCE & SPAM) ---

// 1. Giới hạn đăng nhập: Chỉ cho phép sai 5 lần trong 15 phút
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 5, // Tối đa 5 request
    message: "Bạn đã thử đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.",
    standardHeaders: true,
    legacyHeaders: false,
});

// 2. Giới hạn OTP: Chỉ cho phép gửi 3 lần trong 1 phút
const otpLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 phút
    max: 3,
    message: "Vui lòng đợi 1 phút trước khi yêu cầu gửi lại OTP."
});


// --- CÁC ROUTES ---

router.get("/signup", async (req, res) => {
    res.render("vwaccount/signup", { layout: "account" });
});

// ĐĂNG KÝ: Áp dụng otpLimiter + Input Validation
router.post("/signup", 
    otpLimiter, // <--- Thêm giới hạn spam OTP vào đây
    [
        // Validation Rules
        body('name').notEmpty().withMessage('Họ tên không được để trống').trim().escape(),
        body('email').isEmail().withMessage('Email không hợp lệ').normalizeEmail(),
        body('password').isLength({ min: 6 }).withMessage('Mật khẩu phải từ 6 ký tự trở lên')
    ],
    async (req, res) => {
        // Kiểm tra lỗi validation
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render("vwaccount/signup", {
                layout: "account",
                err_message: errors.array()[0].msg
            });
        }

        // Logic xử lý
        const email = req.body.email;
        const password = req.body.password;
        const name = req.body.name;
        
        const hash = await bcrypt.hash(password, 10);
        
        // Lưu ý: Phần Math.random này là của Thành viên 1, 
        // nếu họ chưa sửa thì bạn cứ giữ nguyên để code chạy được.
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        const result = {
            email: email,
            password: hash,
            name: name,
            otp: otp,
            otpCreatedAt: Date.now()
        }

        const sendotp = await mailer.sendOTP(email, otp);
        if (!sendotp.success) {
            return res.render("vwaccount/signup", {
                layout: "account",
                err_message: "Không thể gửi email OTP. Vui lòng thử lại."
            });
        } else {
            req.session.otpStore = result;
            res.redirect("/account/verify-otp");
        }
    }
);

// GỬI LẠI OTP: Áp dụng otpLimiter
router.post("/resend-otp", otpLimiter, async (req, res) => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const email = req.body.email;
    
    // Kiểm tra session tồn tại không trước khi gán
    if (!req.session.otpStore) {
        return res.json({ success: false, message: "Session expired." });
    }

    req.session.otpStore.otp = otp;
    req.session.otpStore.otpCreatedAt = Date.now();
    
    const sendotp = await mailer.sendOTP(email, otp);
    if (!sendotp.success) {
        return res.json({ success: false, message: "Failed to resend OTP. Please try again later." });
    } else {
        return res.json({ success: true, message: "OTP resent successfully." });
    }
});

router.get("/verify-otp", async (req, res) => {
    // Kiểm tra an toàn: nếu không có session thì đá về login
    if (!req.session.otpStore) return res.redirect('/account/signup');
    res.render("vwaccount/verify-otp", { layout: "account", email: req.session.otpStore.email });
});

router.post("/verify-otp", async (req, res) => {
    console.log(req.body);
    const enteredOtp = req.body.otp;
    const email = req.body.email;
    const otpStore = req.session.otpStore;
    const currentTime = Date.now();
    
    if (!otpStore || otpStore.email !== email) {
        return res.json({ success: false, message: "Invalid session. Please sign up again." });
    } else if (currentTime - otpStore.otpCreatedAt > 5 * 60 * 1000) {
        return res.json({ success: false, message: "OTP has expired. Please sign up again." });
    } else if (enteredOtp !== otpStore.otp) {
        return res.json({ success: false, message: "Invalid OTP. Please try again." });
    } else {
        const result = {
            email: otpStore.email,
            password: otpStore.password,
            name: otpStore.name
        }
        await accountModel.add(result);
        req.session.otpStore = null;
        return res.json({ success: true, message: "OTP verified successfully.", redirectUrl: "/account/signin" });
    }
});

// GET SIGNIN: Không cần limiter ở đây
router.get("/signin", async (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect("/");
    }
    if (req.query.error) {
        return res.render("vwaccount/signin", { layout: "account", err_message: req.query.error });
    }
    res.render("vwaccount/signin", { layout: "account" });
});

router.get("/forgot", (req, res) => {
    res.render("vwaccount/forgot", { layout: "account" });
});

router.get("/signup/is-available", async (req, res) => {
    const email = req.query.email;
    await accountModel.isEmailAvailable(email).then((isAvailable) => {
        res.json({ isAvailable });
    });
});

// POST SIGNIN: Áp dụng loginLimiter + Validation cơ bản
router.post("/signin", 
    loginLimiter, // <--- Rate Limit phải đặt ở đây mới đúng
    [
        body('email').isEmail().withMessage('Email không hợp lệ').normalizeEmail(),
        body('password').notEmpty().withMessage('Mật khẩu không được để trống')
    ],
    async (req, res) => {
        // Check lỗi validation trước
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render("vwaccount/signin", {
                layout: "account",
                err_message: errors.array()[0].msg,
            });
        }

        const email = req.body.email;
        const password = req.body.password;
        const user = await accountModel.findByEmail(email);
        
        if (user === null) {
            return res.render("vwaccount/signin", {
                layout: "account",
                err_message: "Invalid email or password.",
            });
        }
        
        // Sử dụng await bcrypt.compare (Async) - Đã chuẩn Member 3
        const rs = await bcrypt.compare(password, user.password);
        
        if (rs === false) {
            return res.render("vwaccount/signin", {
                layout: "account",
                err_message: "Invalid email or password.",
            });
        }
        
        if (user.is_active === false) { 
            return res.render("vwaccount/signin", {
                layout: "account",
                err_message: "Tài khoản của bạn đã bị khóa.",
            });
        }
        
        req.session.isAuthenticated = true;
        req.session.authUser = user;
        const url = "/";
        res.redirect(url);
    }
);

// ... (Các phần Google Login, Profile, Change Password giữ nguyên như cũ) ...

router.get('/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
    passport.authenticate('google', {
        failureRedirect: '/account/login?error=login+google+failed'
    }),
    (req, res) => {
        console.log('✅ Đăng nhập Google thành công:', req.user);
        req.session.isAuthenticated = true;
        req.session.authUser = req.user;
        if (req.user.password == null) {
            res.redirect('/account/addpassword');
        } else { res.redirect('/'); }
    }
);

router.get("/addpassword", (req, res) => {
    res.render("vwaccount/addpassword", { layout: "account" });
});

router.post("/addpassword", async (req, res) => {
    const newPassword = req.body.newPassword;
    const hash = await bcrypt.hash(newPassword, 10);
    const result = await accountModel.updatePassword(req.user.id, hash);
    if (result) {
        res.redirect("/");
    }
});

router.get("/signout", (req, res) => {
    req.logout(() => {
        res.redirect("/");
    });
});

router.get("/profile", (req, res) => {
    if (!req.session.isAuthenticated) {
        return res.redirect("/account/signin");
    } else { res.render("vwaccount/profile", { layout: "account" }); }
});

router.post("/profile/changeprofile", 
    [
        // Validate tên: Không rỗng, cắt khoảng trắng, KHỬ MÃ ĐỘC (escape)
        body('name').notEmpty().withMessage('Họ tên không được để trống').trim().escape(),
        // Validate email
        body('email').isEmail().withMessage('Email không hợp lệ').normalizeEmail()
    ],
    async (req, res) => {
        // 1. Kiểm tra lỗi validation
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            // Nếu lỗi, trả về JSON để frontend hiển thị (vì code của bạn đang dùng AJAX/Fetch)
            return res.json({ success: false, err_message: errors.array()[0].msg });
        }

        // 2. Logic cũ giữ nguyên
        const userId = req.session.authUser.id;
        const name = req.body.name; // Tên đã được escape an toàn
        const email = req.body.email;
        
        if (email !== req.session.authUser.email || name !== req.session.authUser.name) {
            const isAvailable = await accountModel.isEmailAvailable(email);
            if (!isAvailable && email !== req.session.authUser.email) {
                return res.json({ success: false, err_message: "Email is already in use." });
            } else {
                const result = await accountModel.updateProfile(userId, name, email);
                if (result) {
                    req.session.authUser.name = name;
                    req.session.authUser.email = email;
                    res.json({ success: true, err_message: "Profile updated successfully." });
                }
            }
        } else {
            res.json({ success: false, err_message: "No changes made to profile." });
        }
    }
);

router.post("/profile/changepassword", 
    [
        body('newPassword').isLength({ min: 6 }).withMessage('Mật khẩu mới phải từ 6 ký tự trở lên')
    ],
    async (req, res) => {
        // 1. Kiểm tra lỗi validation
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.json({ success: false, err_message: errors.array()[0].msg });
        }

        // 2. Logic cũ giữ nguyên
        const userId = req.session.authUser.id;
        const currentPassword = req.body.currentPassword;
        const newPassword = req.body.newPassword;
        
        const user = await accountModel.findUserById(userId);
        
        // Dùng await bcrypt.compare (Async) -> Cái này bạn đã sửa rồi, rất tốt!
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        
        if (!isMatch) {
            return res.json({ success: false, err_message: "Current password is incorrect." });
        }
        
        const hash = await bcrypt.hash(newPassword, 10);
        const result = await accountModel.updatePassword(userId, hash);
        if (result) {
            res.json({ success: true, err_message: "Password changed successfully." });
        }
    }
);

export default router;
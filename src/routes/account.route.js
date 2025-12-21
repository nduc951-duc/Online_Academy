import express from "express";
import accountModel from "../models/accout.model.js";
import bcrypt from "bcrypt";
import mailer from "../utils/mailer.js";
import passport from "../config/passport.js";
const router = express.Router();
router.get("/signup", async (req, res) => {
    res.render("vwaccount/signup", { layout: "account" });
});
router.post("/signup", async (req, res) => {
    const email = req.body.email;
    const password = req.body.password;
    const name = req.body.name;
    const hash = await bcrypt.hash(password, 10);

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
        });
    } else {
        req.session.otpStore = result;
        res.redirect("/account/verify-otp");
    }
});
router.post("/resend-otp", async (req, res) => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const email = req.body.email;
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
router.get("/signin", (req, res) => {
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

router.post("/signin", async (req, res) => {
    const email = req.body.email;
    const password = req.body.password;
    const user = await accountModel.findByEmail(email);
    if (user === null) {
        return res.render("vwaccount/signin", {
            layout: "account",
            err_message: "Invalid email or password.",
        });
    }
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
            err_message: "Tài khoản của bạn đã bị khóa.", // Thông báo cho người dùng
        });
    }
    req.session.isAuthenticated = true;
    req.session.authUser = user;
    const url = "/";
    res.redirect(url);
});

router.get('/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
    passport.authenticate('google', {
        failureRedirect: '/account/login?error=login+google+failed'
    }),
    (req, res) => {
        // Successful authentication, redirect home.
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
// router.post("/profile", async (req, res) => {
//     const message = req.body.err_message;
//     console.log(message);
//     // Handle avatar update logic here
//     res.render("vwaccount/profile", { layout: "account", err_message: message });
// });
router.post("/profile/changeprofile", async (req, res) => {
    const userId = req.session.authUser.id;
    const name = req.body.name;
    const email = req.body.email;
    console.log(req.body);
    if (email !== req.session.authUser.email || name !== req.session.authUser.name) {
        const isAvailable = await accountModel.isEmailAvailable(email);
        if (!isAvailable && email !== req.session.authUser.email) {
            return res.json({ success: false, err_message: "Email is already in use." });
        } else {
            const result = await accountModel.updateProfile(userId, name, email);
            if (result) {
                console.log("Profile updated successfully.");
                req.session.authUser.name = name;
                req.session.authUser.email = email;
                res.json({ success: true, err_message: "Profile updated successfully." });
            }
        }

    } else {
        res.json({ success: false, err_message: "No changes made to profile." });
    }
});
router.post("/profile/changepassword", async (req, res) => {
    const userId = req.session.authUser.id;
    const currentPassword = req.body.currentPassword;
    const newPassword = req.body.newPassword;
    const user = await accountModel.findUserById(userId);
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
        return res.json({ success: false, err_message: "Current password is incorrect." });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    const result = await accountModel.updatePassword(userId, hash);
    if (result) {
        res.json({ success: true, err_message: "Password changed successfully." });
    }
});
export default router;
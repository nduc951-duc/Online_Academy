import express from "express";
import adminController from "../controller/admin.controller.js";

const router = express.Router();

// ==========================================
// 🛡️ MIDDLEWARE BẢO MẬT (QUAN TRỌNG)
// ==========================================
// Chỉ cho phép Admin (permission = 0) truy cập
const isAdmin = (req, res, next) => {
    // Kiểm tra session user có tồn tại và permission có phải là 0 không
    if (req.session.authUser && Number(req.session.authUser.permission) === 0) {
        return next();
    }
    // Nếu không phải Admin, đá về trang chủ
    return res.redirect('/');
};

// Áp dụng bảo vệ cho TOÀN BỘ các route bên dưới
router.use(isAdmin);

// ==========================================
// 🚦 ADMIN ROUTES
// ==========================================

// --- Dashboard ---
router.get("/", adminController.dashboard);

// --- Quản lý Danh mục (Categories) ---
router.get("/categories", adminController.categoryManagement);
router.post("/categories/add", adminController.addCategory);
router.get("/categories/edit/:id", adminController.editCategory);
router.post("/categories/update", adminController.updateCategory);
router.post("/categories/delete", adminController.deleteCategory);

// --- Quản lý Khóa học (Courses) ---
router.get("/courses", adminController.courseManagement); // Tên hàm đúng là courseManagement
router.post("/courses/delete", adminController.deleteCourse);
// Nếu controller bạn dùng toggle thì giữ dòng này, nếu dùng lock/unlock riêng thì sửa lại
router.post("/courses/lock", adminController.lockCourse); 
router.post("/courses/unlock", adminController.unlockCourse);

// --- Quản lý Người dùng (Users) ---
router.get("/users", adminController.usersManagement); // Tên hàm đúng là usersManagement
router.post("/users/add", adminController.addUser);
router.post("/users/delete", adminController.deleteUser);
// Các hàm khóa/mở khóa user
router.post("/users/lock", adminController.lockUser);
router.post("/users/unlock", adminController.unlockUser);
// Route cập nhật quyền (nếu có)
router.post("/users/update-role", adminController.updateUserRole);

export default router;
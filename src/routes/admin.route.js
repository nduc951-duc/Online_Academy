import express from "express";
import adminController from "../controller/admin.controller.js";

const router = express.Router();

// ==========================================
// 🛡️ MIDDLEWARE BẢO MẬT
// ==========================================
const isAdmin = (req, res, next) => {
    if (req.session.authUser && Number(req.session.authUser.permission) === 0) {
        return next();
    }
    return res.redirect('/');
};

router.use(isAdmin);

// ==========================================
// 🚦 ADMIN ROUTES
// ==========================================

// --- Dashboard ---
router.get("/", adminController.dashboard);

// --- Quản lý Danh mục (Categories) ---
// SỬA: categoryManagement -> viewCategories
router.get("/categories", adminController.viewCategories); 
router.post("/categories/add", adminController.addCategory);

// ⚠️ CẢNH BÁO: Trong admin.controller.js BẠN CHƯA VIẾT HÀM editCategory
// Mình tạm comment lại để server chạy được. Bạn cần viết hàm này bên controller rồi mới mở ra.
// router.get("/categories/edit/:id", adminController.editCategory); 

router.post("/categories/update", adminController.updateCategory);
router.post("/categories/delete", adminController.deleteCategory);

// --- Quản lý Khóa học (Courses) ---
// SỬA: courseManagement -> viewCourses
router.get("/courses", adminController.viewCourses); 
router.post("/courses/delete", adminController.deleteCourse);

// SỬA: lockCourse/unlockCourse -> toggleCourseLock (Dùng chung logic toggle)
router.post("/courses/lock", adminController.toggleCourseLock); 
router.post("/courses/unlock", adminController.toggleCourseLock);

// --- Quản lý Người dùng (Users) ---
// SỬA: usersManagement -> viewUsers
router.get("/users", adminController.viewUsers); 
router.post("/users/add", adminController.addUser);
router.post("/users/delete", adminController.deleteUser);

// SỬA: lockUser/unlockUser -> toggleUserLock (Dùng chung logic toggle)
router.post("/users/lock", adminController.toggleUserLock);
router.post("/users/unlock", adminController.toggleUserLock);

// SỬA: updateUserRole -> setUserPermission
router.post("/users/update-role", adminController.setUserPermission);

export default router;
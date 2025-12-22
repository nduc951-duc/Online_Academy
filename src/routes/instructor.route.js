import express from "express";
import instructorController from "../controller/instructor.controller.js";
import { createCourseImageUpload, handleUploadErrors } from "../utils/upload.js";\
import courseModel from "../models/course.model.js"; // Nhớ import model

const router = express.Router();


// Middleware kiểm tra chủ sở hữu
const isCourseOwner = async (req, res, next) => {
    const courseId = req.params.id || req.body.courseId; // Lấy ID từ URL hoặc Body
    const instructorId = req.session.authUser.id;

    if (!courseId) return next(); // Nếu không có ID thì bỏ qua (cho route create)

    const isOwner = await courseModel.isCourseOwner(courseId, instructorId);
    if (isOwner) {
        return next();
    }
    
    // Nếu không phải chủ sở hữu -> Chặn
    return res.status(403).render('error', { 
        layout: false, 
        message: 'Bạn không có quyền chỉnh sửa khóa học này!' 
    });
};

// Middleware to check if user is instructor
const isInstructor = (req, res, next) => {
    if (req.session.authUser && req.session.authUser.permission === 2) {
        return next();
    }
    res.redirect('/');
};

router.use(isInstructor);

// Instructor dashboard
router.get('/', instructorController.dashboard);

// Course management routes
router.get('/courses/create', instructorController.showCreateCourse);
router.post('/courses/create', instructorController.createCourse);
router.get('/courses/:id/edit', isCourseOwner, instructorController.showEditCourse);
router.post('/courses/:id/edit', handleUploadErrors, isCourseOwner, instructorController.updateCourse);

// Lecture management routes
router.post('/courses/:id/lectures', instructorController.addLecture);
router.put('/lectures/:lectureId', instructorController.updateLecture);
router.delete('/lectures/:lectureId', instructorController.deleteLecture);

// Video management routes
router.post('/lectures/:lectureId/videos', instructorController.addVideoToLecture);
router.delete('/videos/:videoId', instructorController.deleteVideo);

// Course completion
router.post('/courses/:id/complete', instructorController.markCourseComplete);

// Profile management
router.get('/profile', instructorController.showProfile);
router.post('/profile/update', express.urlencoded({ extended: true }), instructorController.updateProfile);
router.get('/courses/list', instructorController.getMyCourses);
router.get('/profile/public/:id', instructorController.getPublicProfile);

export default router;
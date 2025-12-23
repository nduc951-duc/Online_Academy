import express from "express";
import db from '../utils/db.js';
import courseController from "../controller/course.controller.js";
import courseModel from "../models/course.model.js";
import lectureModel from "../models/lecture.model.js";
import categoryModel from "../models/category.model.js";
// 1. IMPORT VALIDATOR
import { query, body, validationResult } from 'express-validator';

const router = express.Router();

// --- Các route xử lý tìm kiếm ---

// Hàm xử lý logic tìm kiếm (Giữ nguyên logic của bạn)
const handleSearch = async (req, res) => {
    try {
        const q = req.query.q || req.body.searchInput || '';
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = 6;
        const offset = (page - 1) * limit;

        // Xử lý Sort
        let sortBy = req.query.sortBy || 'relevance';
        let sortOrder = 'asc';
        switch (sortBy) {
            case 'newest': sortOrder = 'desc'; break;
            case 'popular': sortOrder = 'desc'; break;
            case 'rating': sortOrder = 'desc'; break;
            case 'price-asc': sortBy = 'price'; sortOrder = 'asc'; break;
            case 'price-desc': sortBy = 'price'; sortOrder = 'desc'; break;
            default: sortBy = 'relevance'; sortOrder = 'asc';
        }

        const filters = {
            category: req.query.category || null,
        };

        const keyword = q;

        const courses = await courseModel.searchPaginated(keyword, limit, offset, sortBy, sortOrder, filters);
        const total = await courseModel.countSearchResults(keyword, filters);

        const totalPages = Math.max(1, Math.ceil(total / limit));
        const pages = Array.from({ length: totalPages }, (_, i) => ({
            value: i + 1,
            isCurrent: i + 1 === page
        }));

        const categories = await categoryModel.getAllForFilter();

        const currentParams = { ...req.query };
        delete currentParams.page;
        const queryParams = new URLSearchParams(currentParams).toString();
        const baseUrl = `/courses/search?${queryParams}`;

        res.render('vwsearch/search', {
            layout: 'main',
            title: `Kết quả tìm kiếm cho "${q}"`,
            q: q,
            amount: total,
            course_card: courses,
            categories: categories.map(cat => ({ id: cat.id, name: cat.category_name })),
            pagination: totalPages > 1 ? {
                currentPage: page,
                totalPages,
                hasPrev: page > 1,
                hasNext: page < totalPages,
                pages,
                baseUrl: baseUrl
            } : null,
            currentSort: {
                sortBy: req.query.sortBy || 'relevance'
            },
            currentFilters: filters
        });
    } catch (error) {
        console.error('Search error:', error);
        res.render('vwsearch/search', {
            layout: 'main',
            title: 'Lỗi tìm kiếm',
            q: req.query.q || req.body.searchInput || '',
            amount: 0,
            course_card: [],
            pagination: null,
            categories: [],
            currentSort: {},
            currentFilters: {},
            errorMessage: 'Đã xảy ra lỗi trong quá trình tìm kiếm.'
        });
    }
};

// 2. MIDDLEWARE VALIDATION (Chống DoS & XSS)
const validateSearch = [
    // Kiểm tra GET param 'q'
    query('q').optional().trim().escape().isLength({ max: 100 }).withMessage('Từ khóa quá dài'),
    // Kiểm tra POST param 'searchInput' (nếu dùng)
    body('searchInput').optional().trim().escape().isLength({ max: 100 }).withMessage('Từ khóa quá dài')
];

// 3. MIDDLEWARE CHECK LỖI
const checkSearchErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).render("error", { 
            layout: false, 
            message: "Yêu cầu không hợp lệ: Từ khóa tìm kiếm quá dài (Max 100 ký tự)!" 
        });
    }
    next();
};

// 4. ÁP DỤNG ROUTE (Sử dụng handleSearch làm handler)
router.get('/search', validateSearch, checkSearchErrors, handleSearch);
router.post('/search', validateSearch, checkSearchErrors, handleSearch);


// --- Các route khác giữ nguyên ---
router.get('/', async function (req, res) {
    res.redirect('/courses/search'); 
});

router.get('/watchlist', courseController.viewWatchlist);
router.get('/:courseId/lecture/:lectureId', courseController.viewLecture);
router.post('/video-progress', courseController.saveVideoProgress);
router.get('/video-progress/:videoId', courseController.getVideoProgress);
router.get('/:id', courseController.detail);
router.post('/:id/watchlist/toggle', courseController.toggleWatchlist);

export default router;
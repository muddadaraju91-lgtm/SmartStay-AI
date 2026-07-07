const express = require('express');
const router = express.Router();
const { searchColleges } = require('../controllers/collegeController');

router.get('/search', searchColleges);

module.exports = router;

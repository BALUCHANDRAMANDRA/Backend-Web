const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
require('dotenv').config();


const User = require('./modules/User');
const Employee = require('./modules/empolyee');
const Request = require('./modules/Request');
const adminOnly = require('./middlewares/adminOnly');
const verifyToken = require('./middlewares/verifyToken');


const app = express();

app.use(express.json());
app.use(cors({
    origin: 'https://adminpanel-phi-nine.vercel.app', 
    credentials: true,
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

mongoose.connect(process.env.MOONGO_DB)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

app.post('/register',async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { username, password } = req.body;
            const existingUser = await User.findOne({ username });
            if (existingUser) {
                return res.status(400).json({ msg: "User already exists" });
            }

            const role = (username === process.env.ADMIN) ? 'admin' : 'user';
            const hashedPassword = await bcrypt.hash(password, 10);

            const newUser = new User({ username, password: hashedPassword, role });
            await newUser.save();

            res.status(200).json({
                success: true,
                msg: "User registration successful"
            });
        } catch (err) {
            console.error(err.message);
            res.status(500).send('Server Error');
        }
    }
);

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(400).json({ msg: "Invalid credentials" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: "Invalid credentials" });
        }

        const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
        const refreshToken = jwt.sign({ userId: user._id }, process.env.REFRESH_SECRET, { expiresIn: '7d' });

        res.status(200).json({
            success: true,
            token,
            refreshToken,
            data: {
                userId: user.id,
                username: user.username,
                role: user.role
            },
            msg: "Login successful"
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

app.post('/refresh-token', (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(403).json({ msg: 'Refresh token not provided' });
    }

    jwt.verify(refreshToken, process.env.REFRESH_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ msg: 'Invalid refresh token' });
        }

        const newAccessToken = jwt.sign(
            { userId: user.userId, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }  
        );

        res.json({ accessToken: newAccessToken });
    });
});

app.get('/get-user', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        if (!user) {
            return res.status(404).json({ success: false, msg: 'User not found' });
        }
        res.status(200).json({
            success: true,
            data: {
                userId: user.id,
                username: user.username,
                role: user.role
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


app.post('/create-employee', adminOnly, upload.single('image'), async (req, res) => {
    try {
        const { name, email, mobile, designation, gender, courses } = req.body;
        const image = req.file ? req.file.filename : '';

        const newEmployee = new Employee({
            userId: req.user.userId,
            name,
            email,
            mobile,
            designation,
            gender,
            courses: Array.isArray(courses) ? courses : [courses],
            image
        });

        await newEmployee.save();
        res.status(200).json({ success: true, msg: "Employee created successfully" });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


app.get('/get-employees',adminOnly, async (req, res) => {
    try {
        const employees = await Employee.find();
        res.status(200).json({ success: true, data: employees });
    } catch (e) {
        console.error(e.message);
        res.status(500).send('Server Error');
    }
});

app.get('/get-employee/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const employee = await Employee.findById(id);
        if (!employee) {
            return res.status(404).json({ success: false, msg: 'Employee not found' });
        }
        res.status(200).json({ success: true, data: employee });
    } catch (e) {
        console.error(e.message);
        res.status(500).send('Server Error');
    }
});

app.put('/update-employee/:id', adminOnly, upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, mobile, designation, gender, courses } = req.body;
        const updatedEmployee = {
            name,
            email,
            mobile,
            designation,
            gender,
            courses: Array.isArray(courses) ? courses : courses.split(',').map(course => course.trim())
        };

        if (req.file) {
            updatedEmployee.image = req.file.filename;
        }

        const employee = await Employee.findByIdAndUpdate(id, updatedEmployee, { new: true });
        if (!employee) {
            return res.status(404).json({ success: false, msg: 'Employee not found' });
        }

        res.status(200).json({ success: true, data: employee });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


app.delete('/delete-employee/:id', adminOnly, async (req, res) => {
    try {
        const { id } = req.params;
        const deletedEmployee = await Employee.findByIdAndDelete(id);
        if (!deletedEmployee) {
            return res.status(404).json({ success: false, msg: 'Employee not found' });
        }
        res.status(200).json({ success: true, msg: 'Employee deleted successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

app.post('/requests', verifyToken, async (req, res) => { 
    const { type, description } = req.body;
    
    if (!req.user) {
        return res.status(403).json({ error: 'User not authenticated' });
    }

    const newRequest = new Request({ userId: req.user.userId, type, description }); 
    
    try {
        await newRequest.save();
        res.status(201).json(newRequest);
    } catch (err) {
        console.error(err.message);
        res.status(400).json({ error: 'Failed to create request' });
    }
});

app.get('/user-requests', verifyToken, async (req, res) => {
    console.log('User authenticated:', req.user);
    try {
        const userRequests = await Request.find({ userId: req.user.userId })
            .populate('userId', 'username') 
            .select('description status createdAt type feedbackMessage'); 
        
        res.json(userRequests); 
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch user requests' });
    }
});

app.get('/admin-requests', verifyToken, adminOnly, async (req, res) => {
    console.log('Admin authenticated:', req.user);
    try {
        const allRequests = await Request.find()
            .populate('userId', 'username')
            .select('description status createdAt type');
        res.json(allRequests); 
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch requests' });
    }
});
app.put('/status/:id', verifyToken, adminOnly, async (req, res) => {
    const { id } = req.params;
    const { status, feedbackMessage } = req.body;

    try {
        const updatedRequest = await Request.findByIdAndUpdate(
            id,
            { status, feedbackMessage },
            { new: true } 
        );

        if (!updatedRequest) {
            return res.status(404).json({ error: 'Request not found' });
        }
        console.log(`Request status updated: ${status}. Feedback: ${feedbackMessage}`);

        res.json({ message: 'Request updated successfully', updatedRequest });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update request' });
    }
});


app.delete('/delete-request/:id', async (req, res) => {
    const { id } = req.params;
    console.log("Request ID to delete:", id);  
    try {
        const deletedRequest = await Request.findByIdAndDelete(id);
        if (!deletedRequest) {
            return res.status(404).json({ message: 'Request not found' });
        }
        res.status(200).json({ message: 'Request deleted successfully', deletedRequest });
    } catch (error) {
        console.error("Error deleting request:", error);  
        res.status(500).json({ message: 'Error deleting request', error });
    }
});



app.listen(process.env.PORT, () => {
    console.log("Server is running on port 5050");
});

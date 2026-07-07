const express = require('express'); // import the framework for the API
const mongoose = require('mongoose'); // import the library to interact with MongoDB
const dotenv = require('dotenv'); // To load environment variables from .env file
const cors = require('cors'); // this allows the frontend to talk to the server for data acquirement. 
const bcrypt = require('bcrypt'); // for password protection
const jwt = require('jsonwebtoken'); // for authentication

dotenv.config(); // activate dotenv to read .env file
const app = express(); // create an instance of the Express application

const User = require('./models/User'); // import the user model
const Post = require('./models/Post'); // import the post model
const auth = require('./middleware/auth'); // import the authentication middleware

// Middleware
app.use(express.json()); // this allows the server to understand JSON data sent from the frontend 
 
// Dynamic CORS configuration
const allowedOrigins = [
    'http://localhost:3000',
    process.env.FRONTEND_URL
];

app.use(cors({
    origin: function (origin, callback) {
         
        if (!origin) return callback(null, true);
        
        const sanitizedOrigin = origin.replace(/\/$/, "");
        const isAllowed = allowedOrigins.some(baseUrl => {
            if (!baseUrl) return false;
            return baseUrl.replace(/\/$/, "") === sanitizedOrigin;
        });

        if (isAllowed || sanitizedOrigin.endsWith('.vercel.app')) {
            return callback(null, true);
        } else {
            console.error(`Blocked by CORS: ${origin}`);
            return callback(new Error('The CORS policy for this site does not allow from the specified Origin'), false);
        }
    },
    credentials: true
}));
 

//============
//   ROUTES
//============

// REGISTER ROUTE
app.post('/api/register', async (req, res) => {
    try { 
        const { username, email, password } = req.body;

        // check if user already exists
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ msg: "User already exists" });

        // Hash the password before saving to the database
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Save to Database
        user = new User({ 
            username,
            email, 
            password: hashedPassword
        });

        await user.save();

        const payload = {
            user: {
                id: user.id,
                username: user.username
            }
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(201).json({ 
            token,
            user: { id: user._id, username: user.username, email: user.email }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// LOGIN ROUTE
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // This check if user exists
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: "User does not exist" });

        //This function Validate password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: "Incorrect password" });

        // This create and send Token
        const payload = {
            user: {
                id: user.id,
                username: user.username
            }
        };
        
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.json({
            token,
            user: { id: user._id, username: user.username, email: user.email }
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// PROTECTED USER DATA ROUTE 
app.get('/api/user/data', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password'); 
        res.json(user);
    } catch (err) {
        res.status(500).json('SERVER ERROR');
    }
});


// CREATE A NEW POST ROUTE

app.post('/api/posts', auth, async (req, res) => {
    try {
        const { title, content } = req.body;

        const newPost = new Post({ 
            title,
            content,
            user: req.user.id 
        });

        const post = await newPost.save();
        
        // 🌟 FIXED THE TYPO HERE: changed from .poplulate to .populate
        await post.populate('user', 'username');
        
        res.json(post);
    } catch (err) {
        
        res.status(500).json('Server Error');
    }
});

// GET ALL POSTS FEED ROUTE
app.get('/api/posts', async (req, res) => {
    try {
        const posts = await Post.find()
            .populate('user', ['username']) 
            .sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// like route
app.put('/api/posts/like/:id', auth, async (customReq, res) => {
    try {
        const post = await Post.findById(customReq.params.id);
        if (!post) {
            return res.status(404).json({ msg: 'Post not found' });
        }

        if (!post.likes) post.likes = [];

 
        const checkingUserId = String(customReq.user.id).trim();

        const alreadyLiked = post.likes.some(like => {
            if (!like.user) return false;
            return String(like.user).trim() === checkingUserId;
        });

        if (alreadyLiked) {
            post.likes = post.likes.filter(like => 
                String(like.user).trim() !== checkingUserId
            );
        } else {
            post.likes.unshift({ user: customReq.user.id });
        }

        await post.save();
        res.json(post.likes);
    } catch (err) {
        console.error("Error in backend like route:", err.message);
        res.status(500).json({ error: err.message });
    }
});


// COMMENT ROUTE
app.post('/api/posts/comment/:id', auth, async (customReq, res) => {
    try {
        const user = await User.findById(customReq.user.id).select('-password');
        const post = await Post.findById(customReq.params.id);

        if (!post) {
            return res.status(404).json({ msg: 'Post not found' });
        }

        const newComment = {
            user: customReq.user.id,
            username: user.username,
            text: customReq.body.text 
        };

        post.comments.unshift(newComment);

        await post.save();
        res.json(post.comments); 
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Post not found' });
        res.status(500).send('Server Error');
    }
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI) 
    .then(async () => {
        console.log("Database is locked and loaded!");
        
    })
    .catch((err) => console.log("DB Connection Error: ", err));
    
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
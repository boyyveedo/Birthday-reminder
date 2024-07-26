const express = require('express');
const bodyParser = require('body-parser')
const { engine } = require('express-handlebars')
const nodemailer = require('nodemailer')
const cron = require('node-cron');
const connectDB = require('./db/connect')
const mongoose = require('mongoose')
const User = require('./model/User')
const path = require('path')
const moment = require('moment-timezone');

require('dotenv').config()

const app = express()
const PORT = 3001

// View engine setup
app.engine('handlebars', engine())
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'))

// Serve static files
app.use('/public', express.static(path.join(__dirname, 'public')))

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json())

// Example route to render 'contact.handlebars'
app.get('/', (req, res) => {
    res.render('contact')
})

// POST route to handle form submission
app.post('/send', async (req, res) => {
    const { username, email, dob } = req.body;

    try {
        // Create a new User document
        const newUser = new User({
            username,
            email,
            dateOfBirth: dob  // Assuming 'dob' is in YYYY-MM-DD format from <input type="date">
        });

        // Save the user to MongoDB
        const savedUser = await newUser.save();
        console.log('User saved to database:', savedUser);

        // Respond with a success message or redirect to another page
        res.send('User registration successful!');

    } catch (error) {
        console.error('Error saving user to database:', error);
        res.status(500).send('Server error: Unable to save user');
    }
})

// MongoDB connection and server start
const start = async () => {
    try {
        await connectDB(process.env.MONGO_URI)
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`)
        })


        cron.schedule('0 7 * * *', async () => {
            try {
                // Use the timezone for Nigeria
                const timezone = 'Africa/Lagos';
                const today = moment.tz(new Date(), timezone);
                const startOfDay = today.clone().startOf('day').toDate();
                const endOfDay = today.clone().endOf('day').toDate();

                console.log(`Running cron job for birthdays on ${today.format('YYYY-MM-DD HH:mm:ss')}`);
                console.log(`Start of the day: ${startOfDay.toISOString()}`);
                console.log(`End of the day: ${endOfDay.toISOString()}`);

                // Find users whose birthday is today
                const users = await User.find({
                    dateOfBirth: {
                        $gte: startOfDay,
                        $lt: endOfDay
                    }
                });

                if (users.length === 0) {
                    console.log('No users with birthdays today.');
                } else {
                    console.log(`Found ${users.length} users with birthdays today.`);
                    // Send birthday emails to each user
                    users.forEach(user => {
                        console.log(`Sending birthday email to: ${user.email}`);
                        sendBirthdayEmail(user); // Define this function to send emails
                    });
                }

            } catch (error) {
                console.error('Error in cron job:', error);
            }
        }, {
            timezone: 'Africa/Lagos'
        });

    } catch (error) {
        console.error('Error starting the server:', error.message)
        process.exit(1)
    }
}

// Nodemailer configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Your Gmail email address
        pass: process.env.EMAIL_PASS  // Your Gmail password or App-Specific Password
    },
    tls: {
        rejectUnauthorized: false
    }
});

// Function to send birthday email
const sendBirthdayEmail = (user) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: 'Happy Birthday ',
        text: `Dear ${user.username},\n\nHappy Birthday. I just wanted to send a quick reminder to keep your head up and stay focused, no matter what challenges come your way. Better days are ahead, and I truly believe that amazing things are in store for you. Keep pushing forward and do not lose sight of your goals. You have got this!\n\nBest regards,\nDavid`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending email:', error);
        } else {
            console.log('Email sent:', info.response);
        }
    });
};

// Start the application
start()

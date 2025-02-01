const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const nodemailer = require("nodemailer");
const dotenv = require('dotenv').config();

const db = new sqlite3.Database("slots.db", (err) => {
    if (err) {
        console.error("Error opening database:", err.message);
    } else {
        console.log("Connected to SQLite database.");
    }
});

db.serialize(() => {
    db.run(
        `CREATE TABLE IF NOT EXISTS Reservations (
            CustomerEmailID TEXT, 
            BookingDate TEXT NOT NULL, 
            CheckInTime TEXT, 
            CheckOutTime TEXT, 
            TotalPrice DECIMAL(10, 2)
        )`,
        (err) => {
            if (err) {
                console.error("Error while creating Reservations table: ", err.message);
            } else {
                console.log("Table Reservations created successfully.");
            }
        }
    );
});

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use(express.urlencoded({ extended: true }));

const smtpTransport = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.emailUser,
        pass: process.env.emailPassword,
    },
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "Homepage.html"));
});

function getBlockedSlots(date, callback) {
    const query = `SELECT CheckInTime FROM Reservations WHERE BookingDate = ?`;
    db.all(query, [date], (err, rows) => {
        if (err) {
            console.error("Error fetching blocked slots:", err.message);
            callback([]);
        } else {
            const blockedSlots = rows.map(row => row.CheckInTime);
            callback(blockedSlots);
        }
    });
}

app.get("/api/dates/", (req, res) => {
    const hours = [];
    for (let hour = 11; hour <= 21; hour++) {
        hours.push(`${hour}:00`);
    }

    const dates = [];
    const todayDate = new Date();
    for (let today = 0; today < 7; today++) {
        const nextDate = new Date(todayDate);
        nextDate.setDate(todayDate.getDate() + today);
        const date = `${String(nextDate.getDate()).padStart(2, "0")}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${nextDate.getFullYear()}`;
        dates.push({ date: date, hours: [...hours], blockedSlots: [] });
    }

    res.json({ dates });
});

app.get("/api/blockedSlots/", (req, res) => {
    const { date } = req.query;

    if (!date) {
        return res.status(400).json({ error: "Date parameter is missing" });
    }

    getBlockedSlots(date, (blockedSlots) => {
        if (!blockedSlots) {
            return res.status(500).json({ error: "Error fetching blocked slots." });
        }

        res.json({ date, blockedSlots });
    });
});

app.post("/api/reservations/", (req, res) => {
    const { date, slots, email } = req.body;
    if (!date || !slots || !Array.isArray(slots) || slots.length === 0 || !email) {
        return res.status(400).json({ error: "invalid data format" });
    }

    const [day, month, year] = date.split("-").map(Number);
    const bookingDate = new Date(year, month - 1, day);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const maxAllowedDate = new Date();
    maxAllowedDate.setDate(maxAllowedDate.getDate() + 6);

    if (bookingDate < today || bookingDate > maxAllowedDate) {
        return res.status(400).json({ error: "Invalid booking date. Date must be between today and the next 6 days."});
    }

    const emailOptions = {
        from: "newmisc7777@gmail.com",
        to: email,
        subject: "Real Turf : Booking Success",
        text: `Hello User, your slot has been booked successfully.\n Date: ${date}\n Time: ${slots}`,
    };

    smtpTransport.sendMail(emailOptions, (error, info) => {
        if (error) {
            console.error("Error sending email:", error);
            return res.status(500).send("Error sending email");
        }
        console.log("Email sent to the user successfully:", info.response);
        res.send("Success email sent successfully");
    });

    const placeholders = slots.map(() => "(?, ?, ?)").join(", ");
    const query = `INSERT INTO Reservations (BookingDate, CheckInTime, CustomerEmailID) VALUES ${placeholders}`;
    const params = slots.flatMap(slot => [date, slot, email]);

    db.run(query, params, function (err) {
        if (err) {
            console.error("Error inserting reservations:", err.message);
            return res.status(500).json({ error: "Failed to save reservations." });
        }
        res.status(200).json({ message: "Reservations saved successfully" });
        console.log("Reservations saved successfully");
    });
});

app.listen(PORT, () => {
    console.log(`Server running at https://localhost:${PORT}`);
});

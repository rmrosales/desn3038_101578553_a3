// Get the client
const mysql = require('mysql2');
require('dotenv').config()

// ATTENTION REQUIRED: Create the connection to database

const pool = mysql.createPool({
    host: process.env.SQL_HOSTNAME,
    user: process.env.SQL_USERNAME,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DBNAME,
});

// Set up the API
const express = require('express')
var cors = require('cors');
const bodyParser = require('body-parser')
const app = express()
const port = 3001

// Make it available for public access

app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', '*');
    next();
});

app.use(cors());
app.options("*", cors());

app.set('json spaces', 2)
app.use(bodyParser.json({
    limit: "50mb"
}))
app.use(
    bodyParser.urlencoded({
        extended: true,
    })
)

// Listen to outside connection

app.listen(port, () => {
    console.log(`App running on port ${port}. Control+C to exit.`)
})

// Spit out data

app.get('/', (request, response) => {
    response.json(
        {
            info: 'Fitness Client Monitoring App, set up by Romeo Martin R!'
        }
    )
})

//Getting the top steps january
app.get("/users/topSteps-JAN", (request, response) => {
    pool.query(`
        SELECT u.name, SUM(a.steps_taken) AS total_steps
        FROM ActivityLogs a
        JOIN Users u ON a.user_id = u.id
        WHERE a.log_date BETWEEN '2025-01-01' AND '2025-01-31'
        GROUP BY u.id
        ORDER BY total_steps DESC
        LIMIT 3
    `, [], (error, result) => {
        response.json({
            status: "success",
            data: result
        });
    });
});

//Users daily calories
app.get("/users/dailyCal", (request, response) => {
    pool.query(`SELECT u.name, m.date, SUM(m.calories) AS total_calories
        FROM Meals m JOIN Users u ON m.user_id = u.id
        GROUP BY m.user_id, m.date
        ORDER BY m.date;
    `, [], (error, result) => {
        response.json({
            status: "success",
            data: result
        });
    });
});

//Users' monthly workout
app.get("/users/monthlyWorkout", (request, response) => {
    pool.query(`
        SELECT u.name,
               DATE_FORMAT(w.date, '%Y-%m') AS month,
               COUNT(*) AS total_workouts,
               SUM(w.duration) AS total_minutes
        FROM Workouts w
        JOIN Users u ON w.user_id = u.id
        GROUP BY w.user_id, month
        ORDER BY month DESC;
    `, [], (error, result) => {
        if (error) throw error;
        response.json({
            status: "success",
            data: result
        });
    });
});

//Adding a new user
app.post("/users/add", (request, response) => {
    const { name, email, age, gender, password_hash } = request.body;

    if (!password_hash) {
        return response.status(400).json({ status: "error", message: "Password is required" });
    }

    pool.query(`
        INSERT INTO Users (name, email, age, gender, password_hash)
        VALUES (?, ?, ?, ?, ?)
    `, [name, email, age, gender, password_hash], (error, result) => {
        if (error) {
            console.error(error);
            return response.status(500).json({ status: "error", message: "Failed to add user" });
        }

        response.json({
            status: "success",
            message: "User added successfully",
            data: { id: result.insertId, name, email }
        });
    });
});

//Log a workout for user
app.post("/workouts/log", (request, response) => {
    const { user_id, date, workout_type, duration } = request.body;

    pool.query(`
        INSERT INTO Workouts (user_id, date, workout_type, duration)
        VALUES (?, ?, ?, ?)
    `, [user_id, date, workout_type, duration], (error, result) => {
        if (error) {
            console.error(error);
            return response.status(500).json({ status: "error", message: "Failed to log workout" });
        }

        response.json({
            status: "success",
            message: "Workout logged successfully",
            data: { id: result.insertId, user_id, date, workout_type, duration }
        });
    });
});

//Find out workout done by a user
app.get("/workouts/username/:username", (request, response) => {
    const { username } = request.params;

    pool.query(`
        SELECT u.name AS username, w.id, w.date, w.workout_type, w.duration
        FROM Workouts w
        JOIN Users u ON w.user_id = u.id
        WHERE u.name = ?
        ORDER BY w.date DESC;
    `, [username], (error, result) => {
        if (error) {
            console.error(error);
            return response.status(500).json({ status: "error", message: "Failed to retrieve workouts" });
        }

        if (result.length === 0) {
            return response.status(404).json({
                status: "error",
                message: `No workouts found for user ${username}`
            });
        }

        response.json({
            status: "success",
            data: result
        });
    });
});

const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = 3000;

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'bus_booking',
    password: 'dev@44440',
    port: 5432,
});

app.use(express.json());

// Create a bus route with date
app.post('/bus-routes', async (req, res) => {
    try {
        const { route_name, total_seats } = req.body;
        const query = 'INSERT INTO bus_routes (route_name, total_seats) VALUES ($1, $2) RETURNING id';
        const values = [route_name, total_seats];
        const result = await pool.query(query, values);
        res.status(201).json({ route_id: result.rows[0].id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred' });
    }
});


// Create a route to handle seat bookings
app.post('/bookings', async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN'); // Start a transaction

        const { route_id, booking_date, passenger_name } = req.body;

        // Check available seats for the specified route and date
        const availableSeatsQuery = 'SELECT total_seats FROM bus_routes WHERE id = $1';
        const availableSeatsValues = [route_id];
        const availableSeatsResult = await client.query(availableSeatsQuery, availableSeatsValues);
        const totalSeats = availableSeatsResult.rows[0].total_seats;

        const bookedSeatsQuery = 'SELECT COUNT(*) FROM bookings WHERE route_id = $1 AND booking_date = $2';
        const bookedSeatsValues = [route_id, booking_date];
        const bookedSeatsResult = await client.query(bookedSeatsQuery, bookedSeatsValues);
        const bookedSeats = bookedSeatsResult.rows[0].count;

        if (bookedSeats >= totalSeats) {
            // No seats available
            res.status(400).json({ message: 'Seats are full. Booking failed.' });
        } else {
            // Book the seat
            const insertQuery = 'INSERT INTO bookings (route_id, booking_date, passenger_name) VALUES ($1, $2, $3)';
            const insertValues = [route_id, booking_date, passenger_name];
            await client.query(insertQuery, insertValues);

            // Decrease available seats count
            const updateSeatsQuery = 'UPDATE bus_routes SET total_seats = total_seats - 1 WHERE id = $1';
            const updateSeatsValues = [route_id];
            await client.query(updateSeatsQuery, updateSeatsValues);

            await client.query('COMMIT'); // Commit the transaction

            res.status(201).json({ message: 'Booking successful.' });
        }
    } catch (error) {
        await client.query('ROLLBACK'); // Rollback the transaction in case of an error
        console.error(error);
        res.status(500).json({ message: 'Booking failed due to an error.' });
    } finally {
        client.release();
    }
});


app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

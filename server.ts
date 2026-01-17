import express from "express";
import pg, { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const app = express();
const port: number = Number(process.env.PORT);
const dbPort: number = Number(process.env.DB_PORT);
const dbUser: string = String(process.env.DB_USER);
const dbPass: string = String(process.env.DB_PASS);
const dbName: string = String(process.env.DB_NAME);
const dbHost: string = "localhost";

app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));

app.use(express.static(path.join(process.cwd(), "public")));
app.use(express.urlencoded({ extended: true }));

const db = new pg.Pool({
  user: dbUser,
  password: dbPass,
  database: dbName,
  host: dbHost,
  port: dbPort,
  max: 20, // Ano to connection limit
  idleTimeoutMillis: 30000,
});

db.connect().catch((err) => console.error("Connection error", err.stack));

interface ICountryRow {
  country_code: string;
}

app.get("/", async (req, res) => {
  try {
    let visitedCountries: string[] = await getVisitedCountries();
    console.log(visitedCountries);
    res.render("index", {
      countries: visitedCountries,
      total: visitedCountries.length,
    });
  } catch (error: any) {
    console.log("Query error: " + error.message);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/add", async (req, res) => {
  const userInput = req.body.country;
  try {
    if (!userInput || userInput.trim() === "") {
      renderIndex(res, {
        notification: {
          type: "warning",
          message: "Please enter a country name!",
        },
      });
    }

    const countryName = userInput.toLowerCase().trim();

    const selectQuery: string =
      "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%' ";
    const countryCodeResult = await db.query(selectQuery, [countryName]);
    console.log(countryCodeResult);
    if (countryCodeResult.rows.length !== 0) {
      const countryCode = countryCodeResult.rows[0].country_code;
      console.log(countryCode);

      const insertQuery: string =
        "INSERT INTO visited_countries(country_code) VALUES ($1)";
      await db.query(insertQuery, [countryCode]);

      const country =
        countryName.charAt(0).toUpperCase() +
        countryName.slice(1).toLowerCase();

      renderIndex(res, {
        notification: {
          type: "success",
          message: `Added ${country} successfully!`,
        },
      });
    } else {
      renderIndex(res, {
        notification: {
          type: "error",
          message: "Country not found, try again.",
        },
      });
    }
  } catch (error: any) {
    const country =
      userInput.charAt(0).toUpperCase() + userInput.slice(1).toLowerCase();
    if (error.code === "23505") {
      renderIndex(res, {
        notification: {
          type: "info",
          message: `You already visited ${country}`,
        },
      });
    } else {
      console.log(error);
      res.status(500).send("Server Error");
    }
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

async function getVisitedCountries() {
  const countryCodes = await db.query(
    "SELECT country_code FROM visited_countries",
  );
  return countryCodes.rows.map((country) => country.country_code);
}

async function renderIndex(res: any, notification: any) {
  const countries = await getVisitedCountries();
  res.render("index", {
    countries,
    total: countries.length,
    notification,
  });
}

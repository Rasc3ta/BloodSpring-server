const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;
const jwt = require("jsonwebtoken");

app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());

const USER = process.env.DB_USER;
const PASS = process.env.DB_PASS;

const { MongoClient, ServerApiVersion, Timestamp } = require("mongodb");
const uri = `mongodb+srv://${USER}:${PASS}@cluster0.yhebin7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// database setup:
const BloodSpringDB = client.db("BloodSpringDB");
const userCollection = BloodSpringDB.collection("userCollection");
const reqCollection = BloodSpringDB.collection("reqCollection");

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );

    // jwt related apis
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // verify jwt:

    const verify = (req, res, next) => {
      const token = req.headers.authorization?.split(" ")[1];
      const email = req.query.email;
      // console.log("token before verification : ", token);
      // console.log(req.headers);

      if (token) {
        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
          if (!err) {
            if (decoded.email === email) {
              req.decoded = decoded;
              next();
            } else {
              console.log("emails don't match thus forbidden");
              console.log("email: ", email);
              console.log(err);
              res.status(403).send("Forbidden");
            }
          } else {
            console.log("faced error when verifying token, token: ", token);
            res.status(401).send("Unauthorized");
          }
        });
      } else {
        console.log("didnt get a token ");
        res.status(401).send("Unauthorized");
      }
    };

    // authentication related apis

    app.post("/addUser", async (req, res) => {
      const user = req.body;
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // getting current user data from database :
    app.get("/getCurrentUser", verify, async (req, res) => {
      const query = {
        email: req.query.email,
      };

      const result = await userCollection.findOne(query);
      res.send(result);
    });

    // profile update related apis :

    app.patch("/updateUserProfile", verify, async (req, res) => {
      const patchData = req.body;
      const email = req.query.email;

      const filter = {
        email,
      };

      const updateDoc = {
        $set: patchData,
      };

      const options = { upsert: false };

      const result = await userCollection.updateOne(filter, updateDoc, options);

      res.send(result);
      // console.log("email = ", email);
      // console.log("patchData = ", patchData);
    });


    // dashboard home related apis:

    app.get("/getLatestThree", verify, async (req, res) => {
      // console.log("got request")
      const query = { email: req.query.email };
      const limit = 3;
      const sort = { timestamp: -1 };

      const cursor = await reqCollection
        .find(query)
        .sort(sort)
        .limit(limit)
        .toArray();

      res.send(cursor);
    });

    // create donation requests related apis:

    app.post("/createDonationRequest", verify, async (req, res) => {
      const formData = req.body.formData;
      console.log(req);
      // console.log(formData);

      const result = await reqCollection.insertOne(formData);
      console.log(result);
      res.send(result);
    });

    // My Donation Requests page related apis :

    app.get("/myDonationRequests", verify, async (req, res) => {
      const query = { email: req.query.email };
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("BloodSpring server running");
});

app.listen(port);

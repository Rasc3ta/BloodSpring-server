const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;
const jwt = require("jsonwebtoken");

app.use(
  cors({
    origin: ["https://bloodspring-7db88.web.app", "http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());

const USER = process.env.DB_USER;
const PASS = process.env.DB_PASS;

const {
  MongoClient,
  ServerApiVersion,
  Timestamp,
  ObjectId,
} = require("mongodb");
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
const blogCollection = BloodSpringDB.collection("blogCollection");

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
      // console.log("email : ", email);
      // console.log("token before verification :  ", token);
      // console.log(req.headers);

      if (!!token) {
        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
          if (!err) {
            console.log("decoded : ", decoded);
            if (decoded.email === email) {
              req.decoded = decoded;
              next();
            } else {
              console.log("emails don't match thus forbidden");
              console.log("email: ", email);
              console.log("decoded email: ", decoded.email);

              // console.log("error : ", err);
              res.status(403).send("Forbidden");
            }
          } else {
            console.log(
              "faced error when verifying token, token : ",
              req.headers.authorization
            );
            res.status(401).send("Unauthorized");
          }
        });
      } else {
        console.log("didnt get a token , token : ", token);

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
      // console.log(req);
      // console.log(formData);

      const result = await reqCollection.insertOne(formData);
      // console.log(result);
      res.send(result);
    });

    // My Donation Requests page related apis :

    app.get("/myDonationRequests", verify, async (req, res) => {
      const query = { email: req.query.email };
      const options = { sort: { timestamp: -1 } };

      const cursor = await reqCollection.find(query, options).toArray();

      res.send(cursor);
    });

    // get a single donation request data :

    app.get("/requests/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id);

      const query = {
        _id: new ObjectId(id),
      };
      const result = await reqCollection.findOne(query);
      // console.log(result)
      res.send(result);
    });

    // edit donation request api:
    app.patch(`/update/:id`, verify, async (req, res) => {
      const query = { _id: new ObjectId(req.params.id) };
      const options = { upsert: false };
      const updateDoc = {
        $set: {
          ...req.body.form,
        },
      };

      const result = await reqCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    // delete donation request api
    app.delete(`/deleteRequest/:id`, async (req, res) => {
      const query = { _id: new ObjectId(req.params.id) };

      const result = await reqCollection.deleteOne(query);

      res.send(result);

      // console.log("delete : ", id);
    });

    // get user count and donation request count

    app.get("/userCount", async (req, res) => {
      const result = await userCollection.estimatedDocumentCount({});
      res.send(`${result}`);
    });

    app.get("/requestCount", async (req, res) => {
      const result = await reqCollection.estimatedDocumentCount({});
      res.send(`${result}`);
    });

    // get all user data
    app.get(`/getAllUsers`, verify, async (req, res) => {
      // console.log(req.query);

      if (req.query.role === "donor") {
        res.status(403).send("forbidden");
      } else {
        const query = {
          email: { $ne: req.query.email },
        };

        const result = await userCollection.find(query).toArray();
        res.send(result);
      }
    });

    // get a user's data

    app.get(`/getUser/:rowId`, verify, async (req, res) => {
      const rowId = req.params.rowId;

      const result = await userCollection.findOne({ _id: new ObjectId(rowId) });

      res.send(result);
    });

    app.patch(`/blockUser/:rowId`, verify, async (req, res) => {
      const rowId = req.params.rowId;

      const filter = {
        _id: new ObjectId(rowId),
      };

      const options = { upsert: false };

      const updateDoc = {
        $set: {
          isActive: false,
        },
      };

      const result = await userCollection.updateOne(filter, updateDoc, options);

      res.send(result);
    });

    app.patch(`/unblockUser/:rowId`, verify, async (req, res) => {
      const rowId = req.params.rowId;

      const filter = {
        _id: new ObjectId(rowId),
      };

      const options = { upsert: false };

      const updateDoc = {
        $set: {
          isActive: true,
        },
      };

      const result = await userCollection.updateOne(filter, updateDoc, options);

      res.send(result);
    });

    app.patch(`/makeAdmin/:rowId`, verify, async (req, res) => {
      const rowId = req.params.rowId;

      const filter = {
        _id: new ObjectId(rowId),
      };

      const options = { upsert: false };

      const updateDoc = {
        $set: {
          role: "admin",
        },
      };

      const result = await userCollection.updateOne(filter, updateDoc, options);

      res.send(result);
    });

    app.patch(`/makeVolunteer/:rowId`, verify, async (req, res) => {
      const rowId = req.params.rowId;

      const filter = {
        _id: new ObjectId(rowId),
      };

      const options = { upsert: false };

      const updateDoc = {
        $set: {
          role: "volunteer",
        },
      };

      const result = await userCollection.updateOne(filter, updateDoc, options);

      res.send(result);
    });

    // all donation request api

    app.get(`/allDonationRequest`, async (req, res) => {
      const result = await reqCollection.find().toArray();
      res.send(result);
    });

    // all pending donation request api

    app.get(`/allPendingRequest`, async (req, res) => {
      const query = { status: "pending" };

      const result = await reqCollection.find(query).toArray();
      res.send(result);
    });

    // add blog to the database

    app.post("/addBlog", verify, async (req, res) => {
      const result = await blogCollection.insertOne(req.body.blog);
      res.send(result);
    });

    // get all the blogs (admin)

    app.get(`/getBlogsContentManagement`, verify, async (req, res) => {
      const result = await blogCollection.find().toArray();
      res.send(result);
    });

    // get all the blogs

    app.get(`/getBlogs`, async (req, res) => {
      const result = await blogCollection
        .find({ status: "published" })
        .toArray();
      res.send(result);
    });

    // get a single blog from id:

    app.get("/getBlog/:id", verify, async (req, res) => {
      // console.log(req.params.id);
      const query = { _id: new ObjectId(req.params.id) };
      const result = await blogCollection.findOne(query);
      res.send(result);
    });

    // publish blog:

    app.patch(`/publishBlog/:id`, verify, async (req, res) => {
      const filter = { _id: new ObjectId(req.params.id) };
      const options = { upsert: false };
      const updateDoc = { $set: { status: "published" } };
      const result = await blogCollection.updateOne(filter, updateDoc, options);
      res.send(result);
    });

    app.patch(`/unpublishBlog/:id`, verify, async (req, res) => {
      const filter = { _id: new ObjectId(req.params.id) };
      const options = { upsert: false };
      const updateDoc = { $set: { status: "draft" } };
      const result = await blogCollection.updateOne(filter, updateDoc, options);
      res.send(result);
    });

    app.delete(`/deleteBlog/:id`, verify, async (req, res) => {
      const query = { _id: new ObjectId(req.params.id) };
      const result = await blogCollection.deleteOne(query);
      res.send(result);
    });

    // update donation status:

    app.patch(`/updateReqStatus`, verify, async (req, res) => {
      if (
        (req.body.status === "pending" || req.body.status === "in progress") &&
        req.query.role === "donor"
      ) {
        res.status(403).send("forbidden");
      }

      const options = { upsert: false };
      const filter = { _id: new ObjectId(req.body.id) };
      const updateDoc = {
        $set: {
          status: req.body.status,
        },
      };

      // const result = await reqCollection.findOne(filter);
      const result = await reqCollection.updateOne(filter, updateDoc, options);

      res.send(result);
    });

    // search donor api

    app.post(`/searchDonor`, async (req, res) => {
      // console.log(req.body.form);

      const donors = await userCollection.find(req.body.form).toArray();

      res.send(donors);
    });

    app.patch("/toInProgress", verify, async (req, res) => {
      const options = { upsert: false };
      const filter = { _id: new ObjectId(req.body.id) };
      const updateDoc = {
        $set: {
          status: "in progress",
          donorEmail: req.body.donorEmail,
          donorName: req.body.donorName,
        },
      };

      console.log({
        status: "in progress",
        donorEmail: req.body.donorEmail,
        donorName: req.body.donorName,
      });

      const result = await reqCollection.updateOne(filter, updateDoc, options);

      res.send(result);
    });

    // get all requests
    app.get("/chartData", async (req, res) => {
      const options = { projection: { district: 1 } };
      const cursor = await reqCollection.find({}, options).toArray();
      res.send(cursor);
    });

    // get all users
    app.get("/userChartData", async (req, res) => {
      const options = { projection: { district: 1 } };
      const cursor = await userCollection.find({}, options).toArray();
      res.send(cursor);
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

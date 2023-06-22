const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 7000;
app.use(cors());
app.use(express.json());
var jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.stripe_key);
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bbqqyyb.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const categoriesCollection = client.db("phone-resale").collection("category");
    const phonesCollection = client.db("phone-resale").collection("phones");
    const usersCollection = client.db("phone-resale").collection("users");
    const ordersCollection = client.db("phone-resale").collection("orders");
    const paymentsColection = client.db("phone-resale").collection("payments");

    app.get("/", (req, res) => {
      res.send("Phone resale server running");
    });

    app.get("/categories", async (req, res) => {
      const query = {};
      const categories = await categoriesCollection.find(query).toArray();
      res.send(categories);
    });

    app.get("/buyers", async (req, res) => {
      const query = {role: "Buyer"};
      const buyers = await usersCollection.find(query).toArray();
      res.send(buyers);
    });

    app.get("/sellers", async (req, res) => {
      const query = {role: "Seller"};
      const sellers = await usersCollection.find(query).toArray();
      res.send(sellers);
    });

    app.get("/category/:name", async (req, res) => {
      const name = req.params.name;
      const query = {};
      const phones = await phonesCollection.find(query).toArray();
      const categoryItems = phones.filter((p) => p.subcategory == name);
      res.send(categoryItems);
    });

    app.get("/phone/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const phone = await phonesCollection.find(query).toArray();
      res.send(phone);
    });

    app.get("/myProducts", async (req, res) => {
      const email = req.query.email;
      const query = { sellerEmail : email };
      const phone = await phonesCollection.find(query).toArray();
      res.send(phone);
    });

    app.get("/myBuyers", async (req, res) => {
      const email = req.query.email;
      const query = { sellerEmail : email };
      const mybuyers = await ordersCollection.find(query).toArray();
      console.log(mybuyers)
      res.send(mybuyers);
    });

    app.post("/addProduct", async (req, res) => {
      const query = req.body;
      const phone = await phonesCollection.insertOne(query);
      res.send(phone);
    });

    app.get("/orders",verifyJwt, async (req, res) => { 
      const email = req.query.email;
      const query = { email: email };
      const orders = await ordersCollection.find(query).toArray();
      res.send(orders);
    });

    app.get("/order/:id", async (req, res) => { 
      const id = req.params.id;
      const query = { _id: new ObjectId(id)};
      const orders = await ordersCollection.find(query).toArray();
      res.send(orders);
    });

    app.post("/orders", verifyJwt, async (req, res) => {
      const query = req.body;
      const order = await ordersCollection.insertOne(query);
      res.send(order);
    });

    app.delete('/order/:id', async(req, res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await ordersCollection.deleteOne(query)
      res.send(result)
    })

    app.delete('/myProduct/:id',verifyJwt, async(req, res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await phonesCollection.deleteOne(query)
      res.send(result)
    })

    app.get("/mobiles", async(req, res)=>{
      const query = {};
      const result = await phonesCollection.find(query).toArray()
      res.send(result)
    })

    app.delete('/seller/:email',verifyJwt, async(req, res)=>{
      const email = req.params.email;
      const query = {
        email: email,
        role : "Seller"  
      }
      const result = await usersCollection.deleteOne(query)
      res.send(result)
    })

    app.delete('/seller/:id', async(req, res)=>{
      const id = req.params.id;
      const query = {_id : new ObjectId(id)}
      const result = await ordersCollection.deleteOne(query)
      res.send(result)
    })
    app.delete('/buyer/:email',verifyJwt, async(req, res)=>{
      const email = req.params.email;
      const query = {
        email: email,
        role : "Seller"  
      }
      const result = await usersCollection.deleteOne(query)
      res.send(result)
    })
    app.post("/users", async (req, res) => {
      const query = req.body;
      const result = await usersCollection.insertOne(query);
      res.send(result);

    });

    app.put("/advertise/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          role: "advertised",
        },
      }
      const result = await phonesCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
    
      res.send(result);
    });

    app.get("/advertise", async (req, res) => { 
      const query = {role: "advertised"};
      const orders = await phonesCollection.find(query).toArray();
      res.send(orders);
    });


    app.get("/admin/:email", async(req, res)=>{
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ isAdmin: user?.role == "admin" });
    })

    app.get("/seller/:email", async(req, res)=>{
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ isSeller: user?.role == "Seller" });
    })


    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = {email: email};
      const user = await usersCollection.findOne(query);
      if (user) {
        var token = jwt.sign({ email }, process.env.jwt_token, {
          expiresIn: "2h",
        });
        return res.send({ accessToken: token });
      }
      return res.status(403).send({ accessToken: "" });
    });

    function verifyJwt(req, res, next) {
      const authHeader = req.headers.autherization;
      if (!authHeader) { 
        return res.status(401).send("Unauthorized acccess");
      }
      const token = authHeader.split(" ")[1];
      jwt.verify(token, process.env.jwt_token, function (err, decoded) {
        if (err) {
          return res.status(403).send({ message: "forbidden access" });
        }
        req.decoded = decoded;
        next();
      });
    }

    app.post('/payments',verifyJwt, async (req, res) => {
      const payment = req.body;
      const result = await paymentsColection.insertOne(payment);
      const id = payment.orderId;
      const filter = {_id: new ObjectId(id)}
      const order = await ordersCollection.findOne(filter);
      const filterinfo = {
          name : order.itemName,
          price: order.itemPrice,
          sellerEmail: order.sellerEmail,
          sellerName: order.sellerName
      }
      const updateInfo = {
        $set: {
          status: "sold",
         
        }
      }
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId
        }
      }

      const updatedResult = await ordersCollection.updateOne(filter, updatedDoc)
      const updatedResult2 = await phonesCollection.updateOne(filterinfo, updateInfo)
      console.log(updatedResult2)
      res.send(result);
  })

    app.post("/create-payment-intent", async (req, res) => {
      const  {order}  = req.body;
      const  price  = parseInt(order.itemPrice);
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        "payment_method_types": ["card"],
      });
    
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

  } finally {
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Phone resale server running on port ${port}`);
});

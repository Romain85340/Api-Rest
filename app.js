const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const exphbs = require("express-handlebars");
const Handlebars = require('handlebars');
const {allowInsecurePrototypeAccess} = require('@handlebars/allow-prototype-access');
const methodOverride = require("method-override");
const path = require("path");
const sharp = require("sharp");
const mongooseAlgolia = require("mongoose-algolia");

// Upload image
const multer = require("multer");
const storage = multer.diskStorage({
    destination: function(req, file, cb){
        cb(null, './public/uploads')
    },
    filename: function(req, file, cb){

        const ext = path.extname(file.originalname);
        const date = Date.now();

        
        cb(null, date + "-" + file.originalname)
        // OU ALORS CETTE OPTION --> cb(null, file.originalname + "-" + date + ext)
    }
})

const upload = multer({ storage : storage,
    limits : {
        fileSize: 1/*Valeur MO*/ * 4000 * 4000 /*Rapport longueur*largeur*/,
        files: 1,
    },
    fileFilter : function(req, file, cb){
        if(
            file.mimetype === "image/png" ||
            file.mimetype === "image/jpeg" ||
            file.mimetype === "image/gif"
        ){ 
            cb(null, true)
        } else {
            cb(new Error("Le fichier doit etre au format png, jpg ou gif"))
        }


        
    }
})
// const upload = multer ({ dest: "public/uploads" })



// Express
const app = express();

// Express Static
app.use(express.static("public"));

// Method-override
app.use(methodOverride("_method"));

// Handlebars

app.engine("hbs", exphbs({defaultLayout: "main", extname: "hbs", handlebars: allowInsecurePrototypeAccess(Handlebars)}));
app.set("view engine", "hbs")

// BodyParser

app.use(bodyParser.urlencoded({
    extended: true
}))

// MongoDB

mongoose.connect('mongodb://localhost:27017/boutiqueGame', { useNewUrlParser: true, useUnifiedTopology: true })

const productSchema = new mongoose.Schema ({
    title: String,
    content: String,
    price: Number,
    category: { type: mongoose.Schema.Types.ObjectId, ref: "category" },
    cover: {
        name: String,
        originalName: String,
        path: String,
        urlSharp: String,
        createAt: Date,
    }
});

const categorySchema = new mongoose.Schema ({
    title: String
})


productSchema.plugin(mongooseAlgolia, {
    appId: "JIY45Y2SS5",
    apiKey: "4fc41d77edfd39eecd9604f7efd93699",
    indexName: 'products', //The name of the index in Algolia, you can also pass in a function
    selector: 'title category', //You can decide which field that are getting synced to Algolia (same as selector in mongoose)
    populate: {
      path: 'category',
      select: 'title',
    },
    defaults: {
      author: 'unknown',
    },
    mappings: {
      title: function(value) {
        return value
      },
    },
    virtuals: {
      whatever: function(doc) {
        return `Custom data ${doc.title}`
      },
    },
    debug: true, // Default: false -> If true operations are logged out in your console
  });



const Product = mongoose.model("product", productSchema)
const Category = mongoose.model("category", categorySchema)


// Routes

app.route("/category")
.get ((req, res) => {
    
    Category.find((err, category) => {
        if (!err) {
            res.render("category", {
                categorie : category
            })
        } else {
            res.send(err)
        }
    })
})
.post((req, res) => {
    const newCategory = new Category ({
        title: req.body.title
    })
    newCategory.save( function(err) {
        if(!err) {
            res.send("Category save")
        } else {
            res.send(err)
        }
    })
})

app.route("/")
.get((req, res) => {
    
    Product
    .find()
    .populate("category")
    .exec(function(err, produit) {
        if(!err) {

            Category.find( function (err, category) {
                res.render("index", {
                    product : produit,
                    categorie: category
                })
            })
        } else {
            res.send(err)
        }
    })
})
.post(upload.single("cover"), (req, res) => {

    const file = req.file;

    sharp(file.path)
    .resize(200)
    .webp({ quality: 80 })
    .toFile("./public/uploads/web/" + file.originalname.split(".").slice(0, -1).join(".") + ".webp", (err, info) => {});

    const newProduct = new Product({
        title: req.body.title,
        content: req.body.content,
        price: req.body.price,
        category: req.body.category,
    });

    if (file) {
        newProduct.cover = {
            name: file.filename,
            originalName: file.originalname,
            // path: "uploads/" + filename,
            path: file.path.replace("public", ""),
            urlSharp : "/uploads/web/" + file.originalname.split(".").slice(0, -1).join(".") + ".webp",
            createAt: Date.now(),
        }
    }

    newProduct.save(function(err){
        if(!err) {
            res.send("save ok")
        } else {
            res.send(err)
        }
    })
})
.delete(function(req, res){
    Product.deleteMany(function(err){
        if(!err){
            res.send("All delete")
        } else {
            res.send(err)
        }
    })
})

// Route edition

app.route("/:id")
.get(function(req, res){
    Product.findOne(
       {_id : req.params.id},
       function(err, produit){
           if(!err) {
               res.render("edition", {
                   _id: produit.id,
                   title: produit.title,
                   content: produit.content,
                   price: produit.price,
               })
           } else {
               res.send("err")
           }
       } 
    )
})

.put(function(req, res){
    Product.update(
        // condition
        {_id: req.params.id},
        // update
        {
            title: req.body.title,
            content: req.body.content,
            price: req.body.price, 
        },
        // option
        {multi: true},
        // exec
        function(err){
            if(!err) {
                res.send("Update ok !")
            } else {
                res.send(err)
            }
        }



    )
})

.delete(function(req, res){
    Product.deleteOne(
        {_id: req.params.id},
        function(err) {
            if(!err){
                res.send("product delete")
            }
            else {
                res.send(err)
            }
        }
    )
})

app.listen(4000, function() {
    console.log("ecoute le port 4000");
})







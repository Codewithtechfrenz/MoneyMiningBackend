const express = require("express");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");

const router = express.Router();

// Multer config
const storage = multer.memoryStorage(); // store in memory
const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB limit
    fileFilter: (req, file, cb) => {
        // Allowed file types
        const filetypes = /jpeg|jpg|png/;
        const mimetype = filetypes.test(file.mimetype.toLowerCase());
        const extname = filetypes.test(file.originalname.toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error("Only .jpeg, .jpg, .png files are allowed!"));
        }
    },
});

// POST /upload
router.post("/", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const formData = new FormData();
        formData.append("file", req.file.buffer, req.file.originalname);

        const response = await axios.post(
            "https://api.pinata.cloud/pinning/pinFileToIPFS",
            formData,
            {
                maxBodyLength: Infinity,
                headers: {
                    ...formData.getHeaders(),
                    Authorization: `Bearer ${process.env.PINATA_JWT}`,
                },
            }
        );

        const hash = response.data.IpfsHash;
        const url = `https://gateway.pinata.cloud/ipfs/${hash}`;

        res.json({ url });
    } catch (error) {
        console.error(error.response?.data || error.message);

        // Multer validation error
        if (error instanceof multer.MulterError) {
            if (error.code === "LIMIT_FILE_SIZE") {
                // return res.status(400).json({ error: "File size exceeds 2 MB" });
                return res.json({ status: 0, message: "File size exceeds 2 MB" })

            }
        }

        // Custom file type error
        if (error.message.includes("Only .jpeg, .jpg, .png")) {
            console.log("error.message: ", error.message);
            return res.json({ status: 0, message: "Only .jpeg, .jpg, .png are available" })
            //   return res.status(400).json({ error: error.message });
        }

        res.status(500).json({ error: "Upload failed" });
    }
});

module.exports = router;

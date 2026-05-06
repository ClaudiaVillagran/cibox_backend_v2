import { Router } from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/upload.js";
import {
  uploadSingle,
  uploadMultiple,
  deleteUpload,
} from "../controllers/uploadController.js";

const router = Router();

router.post("/image", protect, upload.single("image"), uploadSingle);
router.post("/images", protect, upload.array("images", 10), uploadMultiple);
router.delete("/:key", protect, deleteUpload);

export default router;


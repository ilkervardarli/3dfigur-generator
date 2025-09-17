import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs";
import FormData from "form-data";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const form = new formidable.IncomingForm();

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "File parsing error" });
    }

    const file = files.image as formidable.File;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    try {
      const formData = new FormData();
      formData.append("model", "gpt-image-1");
      formData.append("image", fs.createReadStream(file.filepath), {
        filename: file.originalFilename || "upload.png",
        contentType: "image/png",
      });
      formData.append("size", "1024x1024");

      const response = await fetch("https://api.openai.com/v1/images/variations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: formData as any,
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("OpenAI Error:", data);
        return res.status(response.status).json(data);
      }

      res.status(200).json(data);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Image generation failed" });
    }
  });
}

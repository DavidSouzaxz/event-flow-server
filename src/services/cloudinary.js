const cloudinary = require("cloudinary").v2;

async function deleteFromCloudinary(imageUrl) {
  if (!imageUrl) return;

  try {
    // A URL do Cloudinary geralmente é: .../upload/v12345/folder/image_name.jpg
    // Precisamos pegar apenas 'folder/image_name' (o public_id)
    const parts = imageUrl.split("/");
    const fileName = parts[parts.length - 1].split(".")[0]; // Pega 'image_name'
    const folder = parts[parts.length - 2]; // Pega 'folder' se houver

    const publicId = `${folder}/${fileName}`;

    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    return console.error(error);
  }
}
module.exports = { deleteFromCloudinary };

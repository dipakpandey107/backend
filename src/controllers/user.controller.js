import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, username, password } = req.body;
  console.log("email", email);
  if (
    [fullName, email, username, password].some((field) => field?.trim() == "")
  ) {
    throw new ApiError("Bad Request", "Please fill all fields", 400);
  }

  //check user if exists or not

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "user with email and username already exists");
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;

  const coverImageLocalpath = req.files?.coverImage[0]?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath, "avatar");
  const coverImage = await uploadOnCloudinary(coverImageLocalpath, "image");

  if (!avatar) {
    throw new ApiError(400, "Avatar is required");
  }

  if (!coverImage) {
    throw new ApiError(400, "coverImage  is required");
  }

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const CreateUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!CreateUser) {
    throw new ApiError(500, "Server Error !! registring the User");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, CreateUser, "user register succesfully"));
});


 const loginUser = asyncHandler(async (req , res)=>{
      
 })
export { registerUser  , loginUser};

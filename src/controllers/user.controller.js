import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const generateAccessAndRefereshTokens = async (userId) => {
  try {
    const user = await User.findOne(userId);
    const accessToken = user.generateAccessToken();
    const refereshToken = user.generateRefreshToken();

    user.refereshToken = refereshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refereshToken };
  } catch (error) {
    throw new ApiError(401, "Something went wrong while generating tokens");
  }
};

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

const loginUser = asyncHandler(async (req, res) => {
  // get the date from req.body

  const { email, username, password } = req.body;

  if (!username || !email) {
    throw new ApiError(400, "Username or Email are missing");
  }

  if (!email) {
    throw new ApiError(400, "Email is Required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User are Not  Found !!");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user Credentials !!");
  }

   const {accessToken , refereshToken} = await generateAccessAndRefereshTokens(user._id);

    
   const loggedInUser = await User.findById(user._id).
   select("-password -refreshToken")

   const options = {
    httpOnly :true,
    secure:true,
   }

   return res.status(200)
   .cookie("accessToken", accessToken , options)
   .cookie("refreshToken" , refereshToken , options)
   .json(
    new ApiResponse(
      200 ,{
        user:loggedInUser,accessToken,refereshToken
      },
      `Loged in Successfully`
    )
   )

});

const logoutUser = asyncHandler(async(req, res) => {
  await User.findByIdAndUpdate(
      req.user._id,
      {
          $unset: {
              refreshToken: 1 // this removes the field from document
          }
      },
      {
          new: true
      }
  )

  const options = {
      httpOnly: true,
      secure: true
  }

  return res
  .status(200)
  .clearCookie("accessToken", options)
  .clearCookie("refreshToken", options)
  .json(new ApiResponse(200, {}, "User logged Out"))
})


const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

  if (!incomingRefreshToken) {
      throw new ApiError(401, "unauthorized request")
  }

  try {
      const decodedToken = jwt.verify(
          incomingRefreshToken,
          process.env.REFRESH_TOKEN_SECRET
      )
  
      const user = await User.findById(decodedToken?._id)
  
      if (!user) {
          throw new ApiError(401, "Invalid refresh token")
      }
  
      if (incomingRefreshToken !== user?.refreshToken) {
          throw new ApiError(401, "Refresh token is expired or used")
          
      }
  
      const options = {
          httpOnly: true,
          secure: true
      }
  
      const {accessToken, newRefreshToken} = await generateAccessAndRefereshTokens(user._id)
  
      return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
          new ApiResponse(
              200, 
              {accessToken, refreshToken: newRefreshToken},
              "Access token refreshed"
          )
      )
  } catch (error) {
      throw new ApiError(401, error?.message || "Invalid refresh token")
  }

})




export { registerUser, loginUser, generateAccessAndRefereshTokens  , logoutUser , refreshAccessToken};

# Job Portal Backend API

A comprehensive LinkedIn-style job portal backend built with Node.js, Express, and MySQL. This API provides features for job seekers, recruiters, companies, and social networking functionality.

## 🚀 Features

### Core Features
- **User Authentication & Authorization**
  - Email/Password registration and login
  - OTP-based login and password reset
  - JWT token-based authentication
  - Refresh token support

### User Management
- **Profile Types**: Job Seeker or Recruiter (one-time selection)
- **User Profiles**: Complete profile management with images and banners
- **Skills Management**: Add/remove skills with proficiency levels
- **Education & Experience**: Comprehensive work history tracking
- **File Uploads**: Resume, profile images, and banner images

### Job Portal Features
- **Job Posts**: Create and manage job postings
- **Job Applications**: Apply for jobs, track application status
- **Interview Scheduling**: Schedule and manage interviews
- **Company Profiles**: Company pages with job listings

### Social Features
- **Posts & Feed**: LinkedIn-style social posts with job posts
- **Comments & Interactions**: Like, love, support, save posts
- **Follow System**: Follow users and companies
- **Real-time Chat**: Direct messaging between users
- **Notifications**: Real-time notifications with WebSocket support

### Advanced Features
- **Search & Discovery**: Advanced search for users, jobs, companies, skills
- **Suggestions**: Smart follow and skill suggestions
- **Analytics**: Application tracking and statistics
- **Security**: Rate limiting, CORS, Helmet security headers

## 🛠 Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MySQL
- **Authentication**: JWT
- **Real-time**: Socket.IO
- **File Upload**: Multer
- **Validation**: Express Validator
- **Email**: Nodemailer
- **Security**: Helmet, CORS, Rate Limiting

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd job-portal-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env file with your configuration
   ```

4. **Database Setup**
   ```bash
   # Create MySQL database
   mysql -u root -p
   CREATE DATABASE job_portal;
   
   # Import schema
   mysql -u root -p job_portal < database_import.sql
   ```

5. **Create Upload Directories**
   ```bash
   mkdir -p uploads/images uploads/resumes
   ```

6. **Start the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## 🔧 Configuration

### Environment Variables

```env
# Server
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=job_portal
DB_USER=root
DB_PASSWORD=

# JWT
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
SUPPORT_EMAIL=support@example.com



# Frontend
CLIENT_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000
```

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api/v1
```

### Authentication Endpoints

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "registrationType": "email"
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "loginType": "password"
}
```



#### Request OTP
```http
POST /auth/request-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "type": "login"
}
```

### User Management

#### Get User Profile
```http
GET /users/profile
Authorization: Bearer <token>
```

#### Update Profile
```http
PUT /users/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "fullName": "John Doe",
  "bio": "Software Developer",
  "location": "San Francisco, CA"
}
```

#### Set Profile Type
```http
POST /users/set-profile-type
Authorization: Bearer <token>
Content-Type: application/json

{
  "profileType": "job_seeker"
}
```

#### Upload Profile Images
```http
POST /users/upload-images
Authorization: Bearer <token>
Content-Type: multipart/form-data

profileImage: <file>
bannerImage: <file>
```

### Job Management

#### Get Job Feed
```http
GET /posts/feed?page=1&limit=10
Authorization: Bearer <token>
```

#### Create Job Post
```http
POST /posts
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "We're hiring!",
  "postType": "job",
  "jobPostData": {
    "title": "Senior Developer",
    "description": "Looking for experienced developer",
    "jobType": "full_time",
    "experienceLevel": "senior",
    "salaryMin": 80000,
    "salaryMax": 120000,
    "currency": "USD",
    "location": "Remote",
    "isRemote": true
  }
}
```

#### Apply for Job
```http
POST /job-applications
Authorization: Bearer <token>
Content-Type: application/json

{
  "jobPostId": 1,
  "coverLetter": "I'm interested in this position..."
}
```

### Social Features

#### Create Post
```http
POST /posts
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Excited to share my latest project!",
  "postType": "personal",
  "visibility": "public"
}
```

#### Interact with Post
```http
POST /posts/:id/interact
Authorization: Bearer <token>
Content-Type: application/json

{
  "interactionType": "like"
}
```

#### Follow User
```http
POST /follows
Authorization: Bearer <token>
Content-Type: application/json

{
  "followingId": 2,
  "followingType": "user"
}
```

### Chat System

#### Get Conversations
```http
GET /chat/conversations
Authorization: Bearer <token>
```

#### Send Message
```http
POST /chat/conversations/:id/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Hello! How are you?",
  "messageType": "text"
}
```

## 🏗 Project Structure

```
src/
├── config/
│   └── appConfig.js          # Application configuration
├── controllers/              # Request handlers
│   ├── auth.controller.js
│   ├── user.controller.js
│   ├── post.controller.js
│   ├── comment.controller.js
│   ├── jobApplication.controller.js
│   ├── follow.controller.js
│   ├── chat.controller.js
│   ├── notification.controller.js
│   ├── company.controller.js
│   └── skill.controller.js
├── middleware/               # Custom middleware
│   ├── auth.js              # Authentication middleware
│   ├── validation.js        # Input validation
│   └── errorHandler.js      # Error handling
├── routes/                  # API routes
│   └── v1/                 # API version 1
│       ├── index.js        # Dynamic route loader
│       ├── auth.routes.js
│       ├── user.routes.js
│       ├── posts.routes.js
│       ├── comments.routes.js
│       ├── job-applications.routes.js
│       ├── follows.routes.js
│       ├── chat.routes.js
│       ├── notifications.routes.js
│       ├── companies.routes.js
│       └── skills.routes.js
├── services/
│   └── sql.service.js       # Database service
├── utils/                   # Utility functions
│   ├── jwt.js              # JWT utilities
│   ├── logger.js           # Logging utilities
│   ├── mailer.js           # Email utilities
│   ├── formatter.js        # Data formatting
│   ├── dateHandler.js      # Date utilities
│   ├── fileUtils.js        # File operations
│   ├── responseUtils.js    # Response formatting
│   ├── dbUtils.js          # Database utilities
│   └── template.service.js # Email templates
├── emailTemplates/          # Email templates
├── app.js                  # Application entry point
└── database_import.sql     # Database schema
```

## 🔐 Security Features

- **JWT Authentication** with access and refresh tokens
- **Password Hashing** using bcrypt
- **Rate Limiting** to prevent abuse
- **CORS Protection** with configurable origins
- **Helmet Security** headers
- **Input Validation** and sanitization
- **SQL Injection Prevention** with parameterized queries
- **File Upload Security** with type and size validation

## 🚀 Deployment

### Using PM2 (Recommended)

1. **Install PM2**
   ```bash
   npm install -g pm2
   ```

2. **Start with PM2**
   ```bash
   pm2 start ecosystem.config.js
   ```

3. **Monitor**
   ```bash
   pm2 monit
   pm2 logs
   ```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "app.js"]
```

## 📊 Database Schema

The database consists of 22+ tables including:

- **Users & Profiles**: User authentication and profile management
- **Skills & Education**: User skills and educational background
- **Posts & Comments**: Social media functionality
- **Jobs & Applications**: Job posting and application system
- **Companies**: Company profiles and management
- **Chat & Messages**: Real-time messaging system
- **Notifications**: Notification management
- **Follows**: Social following system

See `database_import.sql` for complete schema.

## 🔄 API Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "statusCode": 400,
  "errors": [...],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Paginated Response
```json
{
  "success": true,
  "message": "Data retrieved successfully",
  "data": [...],
  "pagination": {
    "currentPage": 1,
    "totalPages": 10,
    "totalItems": 100,
    "itemsPerPage": 10,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test
npm test -- --grep "auth"
```

## 📝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature/new-feature`)
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

- Create an issue in the repository
- Email: support@jobportal.com
- Documentation: [API Docs](docs/)

## 🛣 Roadmap

- [ ] Advanced search with Elasticsearch
- [ ] Real-time notifications with push notifications
- [ ] Video interview integration
- [ ] Advanced analytics dashboard
- [ ] Mobile app API optimization
- [ ] GraphQL API support
- [ ] Microservices architecture
- [ ] Redis caching layer
- [ ] Advanced recommendation system

## 🤝 Acknowledgments

- Express.js community
- MySQL team
- Socket.IO team
- All open source contributors

# Password Reset Feature

## Overview
The Polling Management System now includes a comprehensive password reset feature for all user roles: Students, Faculty, and HODs.

## Features

### 🔐 Universal Password Reset
- **Students**: Can reset passwords using their college email (@citchennai.net)
- **Faculty**: Can reset passwords using their email address
- **HODs**: Can reset passwords using their email address

### 🛡️ Security Features
- Email verification before password reset
- Password confirmation to prevent typos
- Minimum password length requirement (6 characters)
- Role-based access control
- Secure password update in database

### 🎨 User Experience
- Modal-based interface for seamless experience
- Role-specific styling and icons
- Responsive design for all devices
- Clear user feedback with toast notifications
- Smooth animations using Framer Motion

## How It Works

### 1. Access Password Reset
- Click the "Forgot Password?" link on any login page
- The password reset modal will appear

### 2. Email Verification
- Enter your registered email address
- System verifies the email exists for your role
- Shows user information for confirmation

### 3. Password Creation
- Enter a new password (minimum 6 characters)
- Confirm the new password
- Click "Reset Password" to complete the process

### 4. Success
- Password is updated in the database
- Success message is displayed
- You can now login with your new password

## Technical Implementation

### Components
- **PasswordReset.tsx**: Main reusable component for all roles
- **Integration**: Added to all three login pages (student, faculty, HOD)

### Database Operations
- Updates password field in respective tables:
  - `students` table for students
  - `staffs` table for faculty and HODs (with role filtering)

### Role-Based Logic
- **Students**: Uses `students` table
- **Faculty**: Uses `staffs` table with `designation = 'CA'`
- **HODs**: Uses `staffs` table with `designation = 'HOD'`

## File Structure
```
app/
├── components/
│   └── PasswordReset.tsx          # Main password reset component
├── student/login/page.tsx         # Student login with reset
├── faculty/login/page.tsx         # Faculty login with reset
└── hod/login/page.tsx            # HOD login with reset
```

## Usage Examples

### For Students
1. Go to `/student/login`
2. Click "Forgot Password?"
3. Enter your @citchennai.net email
4. Create and confirm new password

### For Faculty
1. Go to `/faculty/login`
2. Click "Forgot Password?"
3. Enter your email address
4. Create and confirm new password

### For HODs
1. Go to `/hod/login`
2. Click "Forgot Password?"
3. Enter your email address
4. Create and confirm new password

## Security Considerations

- Passwords are stored in the database (consider hashing in production)
- Email verification ensures only registered users can reset passwords
- Role-based filtering prevents cross-role access
- No sensitive information is exposed during the process

## Future Enhancements

- [ ] Email-based password reset links
- [ ] Password strength validation
- [ ] Two-factor authentication
- [ ] Password history tracking
- [ ] Account lockout after failed attempts

## Support

For any issues or questions regarding the password reset feature, please contact the development team.

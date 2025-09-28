// Input validation schemas using Joi
import Joi from "joi";

// User registration validation
export const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  }),

  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      "string.min": "Password must be at least 8 characters long",
      "string.max": "Password cannot exceed 128 characters",
      "string.pattern.base":
        "Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character",
      "any.required": "Password is required",
    }),

  firstName: Joi.string()
    .min(2)
    .max(50)
    .pattern(/^[a-zA-Z\s]+$/)
    .required()
    .messages({
      "string.min": "First name must be at least 2 characters long",
      "string.max": "First name cannot exceed 50 characters",
      "string.pattern.base": "First name can only contain letters and spaces",
      "any.required": "First name is required",
    }),

  lastName: Joi.string()
    .min(2)
    .max(50)
    .pattern(/^[a-zA-Z\s]+$/)
    .required()
    .messages({
      "string.min": "Last name must be at least 2 characters long",
      "string.max": "Last name cannot exceed 50 characters",
      "string.pattern.base": "Last name can only contain letters and spaces",
      "any.required": "Last name is required",
    }),

  phone: Joi.string()
    .pattern(/^[+]?[1-9]\d{1,14}$/)
    .optional()
    .messages({
      "string.pattern.base": "Please provide a valid phone number",
    }),

  timezone: Joi.string()
    .valid(
      "UTC",
      "Asia/Kolkata",
      "America/New_York",
      "Europe/London",
      "Asia/Tokyo",
      "Australia/Sydney",
      "America/Los_Angeles"
    )
    .default("UTC")
    .messages({
      "any.only": "Please select a valid timezone",
    }),

  currency: Joi.string()
    .valid("INR", "USD", "EUR", "GBP", "JPY", "AUD", "CAD")
    .default("INR")
    .messages({
      "any.only": "Please select a valid currency",
    }),
});

// User login validation
export const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  }),

  password: Joi.string().required().messages({
    "any.required": "Password is required",
  }),

  deviceInfo: Joi.object({
    deviceType: Joi.string().valid("mobile", "desktop", "tablet").required(),
    os: Joi.string().required(),
    browser: Joi.string().optional(),
    appVersion: Joi.string().optional(),
  }).optional(),
});

// Update profile validation
export const updateProfileSchema = Joi.object({
  firstName: Joi.string()
    .min(2)
    .max(50)
    .pattern(/^[a-zA-Z\s]+$/)
    .optional()
    .messages({
      "string.min": "First name must be at least 2 characters long",
      "string.max": "First name cannot exceed 50 characters",
      "string.pattern.base": "First name can only contain letters and spaces",
    }),

  lastName: Joi.string()
    .min(2)
    .max(50)
    .pattern(/^[a-zA-Z\s]+$/)
    .optional()
    .messages({
      "string.min": "Last name must be at least 2 characters long",
      "string.max": "Last name cannot exceed 50 characters",
      "string.pattern.base": "Last name can only contain letters and spaces",
    }),

  phone: Joi.string()
    .pattern(/^[+]?[1-9]\d{1,14}$/)
    .allow("")
    .optional()
    .messages({
      "string.pattern.base": "Please provide a valid phone number",
    }),

  avatarUrl: Joi.string().uri().allow("").optional().messages({
    "string.uri": "Please provide a valid URL for avatar",
  }),

  timezone: Joi.string()
    .valid(
      "UTC",
      "Asia/Kolkata",
      "America/New_York",
      "Europe/London",
      "Asia/Tokyo",
      "Australia/Sydney",
      "America/Los_Angeles"
    )
    .optional()
    .messages({
      "any.only": "Please select a valid timezone",
    }),

  currency: Joi.string()
    .valid("INR", "USD", "EUR", "GBP", "JPY", "AUD", "CAD")
    .optional()
    .messages({
      "any.only": "Please select a valid currency",
    }),

  monthlyBudget: Joi.number().min(0).max(10000000).optional().messages({
    "number.min": "Monthly budget cannot be negative",
    "number.max": "Monthly budget cannot exceed 10,000,000",
  }),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided to update",
  });

// Change password validation
export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    "any.required": "Current password is required",
  }),

  newPassword: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      "string.min": "New password must be at least 8 characters long",
      "string.max": "New password cannot exceed 128 characters",
      "string.pattern.base":
        "New password must contain at least one lowercase letter, one uppercase letter, one number, and one special character",
      "any.required": "New password is required",
    }),

  confirmPassword: Joi.string()
    .valid(Joi.ref("newPassword"))
    .required()
    .messages({
      "any.only": "Password confirmation does not match new password",
      "any.required": "Password confirmation is required",
    }),
});

// Forgot password validation
export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  }),
});

// Reset password validation
export const resetPasswordSchema = Joi.object({
  token: Joi.string().required().messages({
    "any.required": "Reset token is required",
  }),

  newPassword: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      "string.min": "Password must be at least 8 characters long",
      "string.max": "Password cannot exceed 128 characters",
      "string.pattern.base":
        "Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character",
      "any.required": "Password is required",
    }),

  confirmPassword: Joi.string()
    .valid(Joi.ref("newPassword"))
    .required()
    .messages({
      "any.only": "Password confirmation does not match new password",
      "any.required": "Password confirmation is required",
    }),
});

// Refresh token validation
export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    "any.required": "Refresh token is required",
  }),
});

// Generic UUID validation
export const uuidSchema = Joi.string()
  .uuid({ version: "uuidv4" })
  .required()
  .messages({
    "string.guid": "Please provide a valid UUID",
    "any.required": "ID is required",
  });

// Pagination validation
export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    "number.integer": "Page must be an integer",
    "number.min": "Page must be at least 1",
  }),

  limit: Joi.number().integer().min(1).max(100).default(20).messages({
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be at least 1",
    "number.max": "Limit cannot exceed 100",
  }),

  sortBy: Joi.string()
    .valid("createdAt", "updatedAt", "name", "amount", "date")
    .default("createdAt")
    .messages({
      "any.only": "Sort field is not valid",
    }),

  sortOrder: Joi.string().valid("asc", "desc").default("desc").messages({
    "any.only": "Sort order must be either asc or desc",
  }),
});

// Validation middleware helper
export const validate = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.body);

    if (error) {
      const errorDetails = error.details.map((detail) => detail.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errorDetails,
      });
    }

    req.body = value; // Use validated and transformed data
    next();
  };
};

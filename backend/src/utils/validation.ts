import Joi from 'joi';

export const authValidation = {
  register: Joi.object({
    email: Joi.string().email().required(),
    username: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().min(8).required(),
    firstName: Joi.string().optional(),
    lastName: Joi.string().optional(),
    phone: Joi.string().optional()
  }),

  signin: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  updateProfile: Joi.object({
    firstName: Joi.string().optional(),
    lastName: Joi.string().optional(),
    bio: Joi.string().optional(),
    phone: Joi.string().optional(),
    theme: Joi.string().valid('dark', 'light').optional(),
    emailNotifications: Joi.boolean().optional(),
    receiveUpdates: Joi.boolean().optional()
  })
};

export const gameValidation = {
  create: Joi.object({
    name: Joi.string().required(),
    category: Joi.string().required(),
    description: Joi.string().optional(),
    icon: Joi.string().optional(),
    thumbnail: Joi.string().optional()
  }),

  update: Joi.object({
    name: Joi.string().optional(),
    category: Joi.string().optional(),
    description: Joi.string().optional(),
    icon: Joi.string().optional(),
    thumbnail: Joi.string().optional()
  })
};

export const tournamentValidation = {
  create: Joi.object({
    name: Joi.string().required(),
    gameId: Joi.string().required(),
    description: Joi.string().optional(),
    prizePool: Joi.number().optional(),
    maxParticipants: Joi.number().optional(),
    startDate: Joi.date().required(),
    endDate: Joi.date().optional()
  }),

  update: Joi.object({
    name: Joi.string().optional(),
    description: Joi.string().optional(),
    prizePool: Joi.number().optional(),
    maxParticipants: Joi.number().optional(),
    status: Joi.string().valid('upcoming', 'ongoing', 'completed').optional(),
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional()
  })
};

export const postValidation = {
  create: Joi.object({
    content: Joi.string().min(1).max(1000).required(),
    image: Joi.string().optional()
  }),

  update: Joi.object({
    content: Joi.string().min(1).max(1000).optional(),
    image: Joi.string().optional()
  })
};

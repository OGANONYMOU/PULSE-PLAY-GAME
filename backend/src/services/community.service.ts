/**
 * @file
 * @description 
 * @author Eric000
 * @date 2/1/2026, 5:20:23 PM
 */

import prisma from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';

export class CommunityService {
  async getAllPosts(skip: number = 0, take: number = 20) {
    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        skip,
        take,
        include: {
          user: {
            select: { id: true, username: true, profilePicture: true }
          },
          comments: {
            take: 3,
            include: {
              user: {
                select: { id: true, username: true, profilePicture: true }
              }
            },
            orderBy: { createdAt: 'desc' }
          },
          _count: {
            select: { comments: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.post.count()
    ]);

    return {
      posts,
      pagination: {
        skip,
        take,
        total,
        pages: Math.ceil(total / take)
      }
    };
  }

  async getPostById(postId: string) {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        user: {
          select: { id: true, username: true, profilePicture: true, bio: true }
        },
        comments: {
          include: {
            user: {
              select: { id: true, username: true, profilePicture: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: { comments: true }
        }
      }
    });

    if (!post) {
      throw new NotFoundError('Post not found');
    }

    return post;
  }

  async getUserPosts(userId: string) {
    return prisma.post.findMany({
      where: { userId },
      include: {
        user: {
          select: { id: true, username: true, profilePicture: true }
        },
        comments: {
          include: {
            user: {
              select: { id: true, username: true, profilePicture: true }
            }
          }
        },
        _count: {
          select: { comments: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createPost(userId: string, content: string, image?: string) {
    return prisma.post.create({
      data: {
        userId,
        content,
        image
      },
      include: {
        user: {
          select: { id: true, username: true, profilePicture: true }
        }
      }
    });
  }

  async updatePost(postId: string, userId: string, content: string, image?: string) {
    const post = await prisma.post.findUnique({
      where: { id: postId }
    });

    if (!post || post.userId !== userId) {
      throw new NotFoundError('Post not found or unauthorized');
    }

    return prisma.post.update({
      where: { id: postId },
      data: { content, image },
      include: {
        user: {
          select: { id: true, username: true, profilePicture: true }
        },
        comments: true
      }
    });
  }

  async deletePost(postId: string, userId: string) {
    const post = await prisma.post.findUnique({
      where: { id: postId }
    });

    if (!post || post.userId !== userId) {
      throw new NotFoundError('Post not found or unauthorized');
    }

    await prisma.post.delete({
      where: { id: postId }
    });
  }

  async likePost(postId: string) {
    return prisma.post.update({
      where: { id: postId },
      data: {
        likes: {
          increment: 1
        }
      }
    });
  }

  async addComment(postId: string, userId: string, content: string) {
    return prisma.comment.create({
      data: {
        postId,
        userId,
        content
      },
      include: {
        user: {
          select: { id: true, username: true, profilePicture: true }
        }
      }
    });
  }

  async deleteComment(commentId: string, userId: string) {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId }
    });

    if (!comment || comment.userId !== userId) {
      throw new NotFoundError('Comment not found or unauthorized');
    }

    await prisma.comment.delete({
      where: { id: commentId }
    });
  }
}

export const communityService = new CommunityService();

const createPost = async (
    authorId: string,
    title: string,
    content: string,
    tag: Post['tag']
  ) => {
    const { error } = await supabase.from('posts').insert({
      author_id: authorId,
      title,
      content,
      tag,
    } as Database['public']['Tables']['posts']['Insert']);
    return { error };
  };

  const likePost = async (postId: string, currentLikes: number) => {
    const { error } = await supabase
      .from('posts')
      .update({ likes: currentLikes + 1 } as Database['public']['Tables']['posts']['Update'])
      .eq('id', postId);
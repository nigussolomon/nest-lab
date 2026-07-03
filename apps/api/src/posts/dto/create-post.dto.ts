import { ApiProperty } from '@nestjs/swagger';

export class CreatePostDto {
  @ApiProperty({ example: 'My First Post', description: 'Post title' })
  title: string;

  @ApiProperty({
    example: 'Hello world!',
    description: 'Post content',
    required: false,
  })
  content?: string;

  @ApiProperty({ example: 1, description: 'ID of the author' })
  authorId: number;
}

import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  email: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'User display name',
  })
  name: string;

  @ApiProperty({
    example: 1,
    description: 'Category ID',
    required: false,
  })
  categoryId?: number;
}

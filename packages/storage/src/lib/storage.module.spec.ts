import { Test } from '@nestjs/testing';
import { StorageModule } from './storage.module';

describe('StorageModule', () => {
  it('should be defined', () => {
    expect(StorageModule).toBeDefined();
  });

  it('should compile the module', async () => {
    const module = await Test.createTestingModule({
      imports: [StorageModule],
    }).compile();

    expect(module).toBeDefined();
    expect(module.get(StorageModule)).toBeInstanceOf(StorageModule);
  });
});

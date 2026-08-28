import { processIrNews } from '../features/ir_news';

export { processIrNews };

if (require.main === module) {
  processIrNews().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
  });
}

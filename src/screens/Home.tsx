import './home.css';

interface Props {
  hasSave: boolean;
  onStart: () => void;
  onResume: () => void;
  onHowTo: () => void;
}

export default function Home({ hasSave, onStart, onResume, onHowTo }: Props) {
  return (
    <main className="home">
      <div className="home-hero" aria-hidden="true">
        <img src="assets/maps/canal.webp" alt="" />
      </div>
      <section className="home-card panel">
        <h1 className="home-title">สิ้นเดือนยังไหว</h1>
        <p className="home-sub">
          บอร์ดเกมวางแผนชีวิตในเมืองไทย 2–8 คน · 8 สัปดาห์ · ผลัดกันเล่นบนจอเดียว
        </p>
        <p>จัดเวลาเดินทาง ทำงาน พัก เรียนทักษะ และเปิดร้าน เพื่อจ่ายบิลให้ทัน และย้ายสายงานให้สำเร็จ</p>
        <div className="home-actions">
          <button className="btn btn-primary" data-testid="home-start" onClick={onStart}>
            เริ่มเกม
          </button>
          {hasSave && (
            <button className="btn" data-testid="home-resume" onClick={onResume}>
              เล่นต่อ
            </button>
          )}
          <button className="btn btn-ghost" data-testid="home-howto" onClick={onHowTo}>
            วิธีเล่น
          </button>
        </div>
      </section>
    </main>
  );
}

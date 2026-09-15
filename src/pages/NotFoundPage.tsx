import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <section className="empty-page">
      <span>404</span>
      <h1>관리툴을 찾지 못했습니다</h1>
      <p>주소가 바뀌었거나 아직 React 화면으로 등록되지 않은 도구입니다.</p>
      <Link to="/">관리툴 홈으로</Link>
    </section>
  );
}

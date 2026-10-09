import Link from "next/link";

export function BrandLink() {
  return (
    <Link className="brand" href="/" aria-label="PactFlow">
      <img
        className="brand-mark"
        src="/brand/pactflow-mark.png"
        width={40}
        height={40}
        alt=""
      />
      <span className="brand-name">PactFlow</span>
    </Link>
  );
}

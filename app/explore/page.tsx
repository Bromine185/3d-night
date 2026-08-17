import type { Metadata } from "next";
import { ExploreClient } from "@/components/explore/ExploreClient";

export const metadata: Metadata = {
  title: "3d-night · explore",
  description:
    "The strategy's parameter space as terrain: fly the ridge, summon the breaker, scrub through time.",
};

export default function ExplorePage() {
  return <ExploreClient />;
}

import type { PageProps } from "../../shared/types.ts";
import AnimalRecordPage from "./AnimalRecordPage.tsx";
import PageHeading from "../../shared/layout/PageHeading.tsx";
import AnimalsSection from "./components/AnimalsSection.tsx";

export default function AnimalsPage({
  data,
  actions,
  route,
  pending,
}: PageProps) {
  const [, id, tab] = (route || "").slice(1).split("/");
  if (id)
    return (
      <AnimalRecordPage
        id={id}
        tab={tab}
        data={data}
        actions={actions}
        pending={pending}
      />
    );
  return (
    <>
      <PageHeading
        title="Mes animaux"
        description="Un carnet pour chacun de vos compagnons."
        actionLabel="Ajouter un animal"
        onAction={() => actions.add("animal")}
      />
      <div className="app-grid">
        <div className="app-left">
          <AnimalsSection
            animals={data.animals}
            onOpen={actions.openAnimal}
            onAdd={() => actions.add("animal")}
          />
        </div>
      </div>
    </>
  );
}

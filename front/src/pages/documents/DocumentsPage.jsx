import PageHeading from "../../shared/layout/PageHeading.jsx";
import DocumentsSection from "./components/DocumentsSection.jsx";

export default function DocumentsPage({ data, actions }) {
  return (
    <>
      <PageHeading
        title="Mes documents"
        description="Les documents de vos animaux, au même endroit."
        actionLabel="Ajouter un document"
        onAction={() => actions.add("document")}
      />
      <DocumentsSection
        shares={data.shares}
        documents={data.documents}
        animals={data.animals}
        onAdd={() => actions.add("document")}
        onAction={actions.openDocument}
      />
    </>
  );
}

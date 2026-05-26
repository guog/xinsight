import WorkflowEditor from "@/components/workflow-editor"

type Params = { params: Promise<{ id: string }> }

export default async function EditWorkflowPage({ params }: Params) {
  const { id } = await params
  return <WorkflowEditor initialId={id} isEdit={true} />
}

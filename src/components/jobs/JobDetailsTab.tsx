interface JobDetailsTabProps {
  description: string;
  requirements: string | null;
  preferredSkills: string | null;
  skills: string[];
}

export function JobDetailsTab({
  description,
  requirements,
  preferredSkills,
  skills,
}: JobDetailsTabProps) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b">
        <h3 className="text-sm font-medium">求人内容</h3>
      </div>
      <div className="px-5 py-4 space-y-5">
        <div>
          <h4 className="font-medium mb-2 text-balance">詳細</h4>
          <p className="text-sm whitespace-pre-wrap text-pretty">
            {description}
          </p>
        </div>
        {requirements && (
          <div>
            <h4 className="font-medium mb-2 text-balance">必須要件</h4>
            <p className="text-sm whitespace-pre-wrap text-pretty">
              {requirements}
            </p>
          </div>
        )}
        {preferredSkills && (
          <div>
            <h4 className="font-medium mb-2 text-balance">歓迎スキル</h4>
            <p className="text-sm whitespace-pre-wrap text-pretty">
              {preferredSkills}
            </p>
          </div>
        )}
        {skills.length > 0 && (
          <div>
            <h4 className="font-medium mb-2 text-balance">必須スキル</h4>
            <div className="flex flex-wrap gap-1">
              {skills.map((skill) => (
                <span
                  key={skill}
                  className="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

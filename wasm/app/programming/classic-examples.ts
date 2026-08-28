export interface ClassicProgramExample {
  id: string;
  title: string;
  description: string;
  requiredFields: string[];
  source: string;
}

export const CLASSIC_PROGRAM_EXAMPLES: readonly ClassicProgramExample[] = [
  {
    id: "life-stage-by-sex",
    title: "Life-stage age groups by sex",
    description: "Groups Age into five public-health life stages and runs FREQ within Sex.",
    requiredFields: ["Age", "Sex"],
    source: `DEFINE AgeGroup TEXTINPUT
RECODE Age TO AgeGroup
  LOVALUE - 4 = "0-4"
  4 - 17 = "5-17"
  17 - 44 = "18-44"
  44 - 64 = "45-64"
  64 - HIVALUE = "65+"
END
FREQ AgeGroup STRATAVAR=Sex`,
  },
  {
    id: "age-band-by-case-status",
    title: "Broad age bands by case status",
    description: "Compares child, adult, and older-adult bands within the foodborne Case Status categories.",
    requiredFields: ["Age", "case_status"],
    source: `DEFINE BroadAgeGroup TEXTINPUT
RECODE Age TO BroadAgeGroup
  LOVALUE - 17 = "0-17"
  17 - 64 = "18-64"
  64 - HIVALUE = "65+"
END
FREQ BroadAgeGroup STRATAVAR=case_status`,
  },
  {
    id: "age-decades",
    title: "Age distribution by decade",
    description: "Creates decade-width age categories and runs an overall frequency table without stratification.",
    requiredFields: ["Age"],
    source: `DEFINE AgeDecade TEXTINPUT
RECODE Age TO AgeDecade
  LOVALUE - 9 = "0-9"
  9 - 19 = "10-19"
  19 - 29 = "20-29"
  29 - 39 = "30-39"
  39 - 49 = "40-49"
  49 - 59 = "50-59"
  59 - 69 = "60-69"
  69 - HIVALUE = "70+"
END
FREQ AgeDecade`,
  },
] as const;

export function classicProgramExampleById(id: string): ClassicProgramExample | undefined {
  return CLASSIC_PROGRAM_EXAMPLES.find((example) => example.id === id);
}

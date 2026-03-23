export type CourseLevel = 'Regular' | 'Advanced' | 'AP' | 'IB' | 'OnRamps' | 'DualCredit' | 'Applied' | 'Functional';

export interface Course {
  id: string;
  name: string;
  peims: string;
  credits: number;
  subject: string;
  level: CourseLevel;
  prerequisites?: string[];
  description?: string;
  isWeighted?: boolean;
  isNCAAApproved?: boolean;
}

export interface PlannedCourse {
  courseId: string;
  year: 'MiddleSchool' | 'Freshman' | 'Sophomore' | 'Junior' | 'Senior' | 'Summer';
  semester: 'A' | 'B' | 'Both';
}

export interface GraduationPlan {
  id: string;
  name: string;
  requiredCredits: {
    [subject: string]: number;
  };
  totalCredits: number;
}

export interface Endorsement {
  id: string;
  name: string;
  category: 'STEM' | 'BusinessIndustry' | 'ArtsHumanities' | 'PublicService' | 'Multidisciplinary';
  requirements: string;
}

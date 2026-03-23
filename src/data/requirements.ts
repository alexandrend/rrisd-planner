import { GraduationPlan, Endorsement } from '../types';

export const GRADUATION_PLANS: GraduationPlan[] = [
  {
    id: 'foundation',
    name: 'Foundation Plan',
    requiredCredits: {
      'ELA': 4,
      'Math': 3,
      'Science': 3,
      'Social Studies': 4,
      'LOTE': 2,
      'Fine Arts': 1,
      'PE': 1,
      'Electives': 5
    },
    totalCredits: 23
  },
  {
    id: 'endorsement',
    name: 'Foundation Plan w/ Endorsements',
    requiredCredits: {
      'ELA': 4,
      'Math': 4,
      'Science': 4,
      'Social Studies': 4,
      'LOTE': 2,
      'Fine Arts': 1,
      'PE': 1,
      'Electives': 7
    },
    totalCredits: 27
  },
  {
    id: 'dla',
    name: 'Distinguished Level of Achievement',
    requiredCredits: {
      'ELA': 4,
      'Math': 4, // Must include Algebra II
      'Science': 4,
      'Social Studies': 4,
      'LOTE': 2,
      'Fine Arts': 1,
      'PE': 1,
      'Electives': 7
    },
    totalCredits: 27
  }
];

export const ENDORSEMENTS: Endorsement[] = [
  {
    id: 'stem',
    name: 'STEM',
    category: 'STEM',
    requirements: 'Algebra II, Chemistry, and Physics required. 5 Math or 5 Science credits.'
  },
  {
    id: 'business_industry',
    name: 'Business & Industry',
    category: 'BusinessIndustry',
    requirements: 'Coherent sequence of 4 or more CTE credits.'
  },
  {
    id: 'arts_humanities',
    name: 'Arts & Humanities',
    category: 'ArtsHumanities',
    requirements: '5 Social Studies credits OR 4 levels of same LOTE OR 2 levels of 2 different LOTEs OR 4 credits in Fine Arts.'
  },
  {
    id: 'public_service',
    name: 'Public Service',
    category: 'PublicService',
    requirements: 'Coherent sequence of 4 or more CTE credits in Education, Health Science, Law, or JROTC.'
  },
  {
    id: 'multidisciplinary',
    name: 'Multidisciplinary',
    category: 'Multidisciplinary',
    requirements: '4 advanced courses OR 4 credits in each foundation area OR 4 AP/IB/Dual Credit courses.'
  }
];

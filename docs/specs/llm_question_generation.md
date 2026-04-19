# LLM Question Generation – Quizazz

Quizazz is a study tool with multiple-choice questions. 

I need you to generate questions for Quizazz that will be downloaded as a YAML file. 
Given the list of topics below, start with the first topic and loop through all the steps, one-by-one. Pause after each step for review. 

## Domain
A quiz features a way to to test a domain of knowledge as a collection of topics organized in hierarchy.  
Each topic is a collection of knowledge that consists of up to 50 questions. A topic can have subtopics, to help chunk the user understand their competence in narrower areas of a topic. 

The questions are configured by topic in separateYAML files. Each question set will be presented to the user as a group. Quizazz will aggregate scores by subtopic, topic, and overall. Navigation to question groups in a quiz is via a tree view that matches the directory structure of the YAML files.

## Example
YAML file and directorynaming can be arbitrary, the menu names in the YAML files will be what appears in the quiz navigation. 
- data/myquiz/topic_1.yaml
- data/myquiz/topic_2.yaml
- data/myquiz/topic_3.yaml
- data/myquiz/topic_4.yaml
- data/myquiz/advanced/topic_5.yaml
- data/myquiz/advanced/extra/topic_6.yaml
 
The number of questions for each topic should match the importance of the topic in the overall domain. The Quizazz builder will generate separate YAML files for each topic. During testing Quizazz will aggregate scores by subtopic, topic, and overall. Navigation to question groups in a quiz is via a tree view that matches the directory structure of the YAML files.


## Steps 
1. Get a topic assignment from the user and the number of questions to generate for the topic. 
2. Create a subtopic plan for the current topic with a weight of importance within the topic. 
3. Create the number of questions for the current topic distributed by weight across the subtopics. 
4. Add one or more tags to each question (that can be used to filter down to similar questions). While subtopics tend to be long-form, a tag should be one or two simple, lowercase keywords. 
5. Create answers in each answer category (correct, partially correct, incorrect, etc) for each of the questions. 
6. Create another set of answers for each question and merge them into the existing answers. The correct answer will just be worded differently, but is the same in substance as the existing correct answer(s). The other answer categories can differ from the existing ones. 
7. Generate a YAML file with the header (menu_name, menu_description, quiz_description) and questions (organized optionally by subtopic) and answers.

I will reply "proceed" for each step, and if that was the last step, then you can move to the next topic and restart the steps.

## YAML Output Format Example
Subtopics and tags are optional. 
```yaml
menu_name: "European Geography"
menu_description: "Capital cities of European countries"
quiz_description: "Test your knowledge of European geography"
questions: 
  - question: "What is the capital of the United Kingdom?"
    answers: 
        correct: 
        - text: "London"
            explanation: "London has been the capital of the United Kingdom since 1707 when the Acts of the Union merged England and Scotland into a single state, the Kingdom of Great Britain."
        partially correct: 
        - text: "Winchester"
            explanation: "Winchester was the capital of England in the Anglo-Saxon period."
        incorrect:
        - text: "Cambridge"
            explanation: "Cambridge is a city in England, but not the capital."
        - text: "Staffordshire"
            explanation: "Staffordshire is a county in England, but not the capital."
        - text: "Ireland"
            explanation: "Ireland is an island, not a city."
        ridiculous:
        - text: "Chunnel"
            explanation: "The Chunnel is a tunnel for trains that travels under the English Channel and connects England and France."
        - text: "Mr. Bean"
            explanation: "Mr. Bean is a character from a British sitcom, not a city."
  - subtopic: "Western European Continent"
    questions: 
      - question: "What is the capital of France?"
        tags: ["geography", "europe"]
        answers:
            correct:
            - text: "Paris"
                explanation: "Paris has been the capital of France since the 10th century."
            partially_correct:
            - text: "Lyon"
                explanation: "Lyon is the second-largest city but not the capital."
            incorrect:
            - text: "Berlin"
                explanation: "Berlin is the capital of Germany."
            - text: "Europe"
                explanation: "Europe is a continent, not a city."
            ridiculous:
            - text: "Atlantis"
                explanation: "Atlantis is a mythical city."
            - text: "The Moon"
                explanation: "The Moon is not a city."
```


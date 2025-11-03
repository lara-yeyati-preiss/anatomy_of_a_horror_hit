Live demo: [https://lara-yeyati-preiss.github.io/anatomy_of_a_horror_hit/](https://lara-yeyati-preiss.github.io/anatomy_of_a_horror_hit)

# Anatomy of a Horror Hit  
**by Lara Yeyati Preiss**  

---

## Concept  
This project explores horror as a cultural barometer—capturing, distorting, and projecting our collective fears back to us.  
Using **Netflix’s Engagement Report (Jan–Jun 2025)**, it examines what the platform’s most-watched horror titles reveal about contemporary anxieties.  

The site unfolds as a scrollytelling narrative. It begins by analyzing the **Hit Matrix**, which visualizes how a hit looks across genres by mapping quadrants defined by **IMDb ratings** (as a proxy for prestige) and **total views** (as a proxy for reach).  
It then zooms in on horror as the poster child of the *“cult corner”*: lower budgets, strong identity, and small but loyal audiences.  
Finally, it traces horror’s **recurring fear patterns**, inviting users to explore them through an **interactive bar chart** that visualizes the genre’s emotional architecture.  

---

## Data & Methods  

**Data sources:**  
- Netflix Engagement Report (Jan–Jun 2025)  
- OMDb API  
- IMDb API  

**Processing:**  
- Film metadata was fetched, cleaned, and processed in Python.  
- Each title was classified by **core fear** using a hybrid process: a local **LLaMA-3 (8B)** model run via **Ollama**, prompted with each film’s title, synopsis, and keywords, guided by a **manually designed taxonomy** and labeled examples of distinct fear categories.  
- Model results were manually reviewed and refined for thematic coherence.  
- Several fear types were consolidated into **three higher-order supergroups**, reflecting broader dimensions of human anxiety.  
- Keyword frequencies were aggregated from IMDb tags to identify the most common thematic vocabularies within each supergroup.
  



<img width="1721" height="868" alt="image" src="https://github.com/user-attachments/assets/df116740-42e8-4a0e-9d56-491eab0cff20" />
<img width="1721" height="868" alt="image" src="https://github.com/user-attachments/assets/4199630e-f497-4a96-9a70-b5d7488bf97d" />
<img width="1721" height="868" alt="image" src="https://github.com/user-attachments/assets/f7d09960-8a90-4623-b28a-c8dce812ef39" />
<img width="1721" height="868" alt="image" src="https://github.com/user-attachments/assets/36742e4a-3add-4284-b638-4b3ab9ee47d7" />
<img width="1721" height="868" alt="image" src="https://github.com/user-attachments/assets/0d85d69f-3853-4255-ab2f-2c870c264d0c" />

